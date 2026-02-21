"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { deleteAttachment, listAttachments, type AttachmentBucketItem } from "@/lib/attachments";
import { invalidateAttachmentsQueries } from "@/lib/query-utils";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, ImageIcon, LayoutGrid, Rows2, Search, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ATTACHMENTS_VIEW_MODE_STORAGE_KEY = "@attachments_view_mode";

export default function AttachmentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isViewModeLoaded, setIsViewModeLoaded] = useState(false);
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentBucketItem | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleResize = () => {
        if (typeof window !== "undefined") {
          setScreenWidth(window.innerWidth);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    } else {
      const subscription = Dimensions.addEventListener("change", ({ window }) => {
        setScreenWidth(window.width);
      });
      return () => subscription?.remove();
    }
  }, []);

  useEffect(() => {
    const loadViewMode = async () => {
      try {
        const saved = await AsyncStorage.getItem(ATTACHMENTS_VIEW_MODE_STORAGE_KEY);
        if (saved && (saved === "grid" || saved === "list")) {
          setViewMode(saved);
        }
      } catch {
        // ignore
      } finally {
        setIsViewModeLoaded(true);
      }
    };
    loadViewMode();
  }, []);

  useEffect(() => {
    if (isViewModeLoaded) {
      AsyncStorage.setItem(ATTACHMENTS_VIEW_MODE_STORAGE_KEY, viewMode).catch(() => { });
    }
  }, [viewMode, isViewModeLoaded]);

  const {
    data: attachments = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["attachments", user?.id],
    queryFn: () => listAttachments(user?.id),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
    retry: false, // When offline, fail once and show cached list from listAttachments() fallback
    placeholderData: (previousData) => previousData,
    retryOnMount: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (url: string) => deleteAttachment(url),
    onSuccess: () => {
      invalidateAttachmentsQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteDialogOpen(false);
      setSelectedAttachment(null);
    },
  });

  const filteredAttachments = attachments.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.contentType && item.contentType.toLowerCase().includes(q))
    );
  });

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await refetch();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCopyLink = async (item: AttachmentBucketItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(item.url);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // clipboard not available
      }
    } else {
      try {
        await Share.share({
          message: item.url,
          title: "Attachment link",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // user dismissed share
      }
    }
  };

  const openActionModal = (item: AttachmentBucketItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedAttachment(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedAttachment) return;
    await deleteMutation.mutateAsync(selectedAttachment.url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
  };

  const isSmallScreen = screenWidth < 768;
  const columns = 2;

  return (
    <View
      className="flex-1 w-full mx-auto"
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
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
            justifyContent: "space-between",
            height: 56,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.replace("/(app)/settings");
              }}
              style={{ padding: 8, marginRight: 8 }}
            >
              <ArrowLeft color={colors.foreground} size={24} />
            </Pressable>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              Attachments
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                setViewMode((m) => (m === "grid" ? "list" : "grid"));
              }}
              style={{ padding: 8 }}
            >
              {viewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} strokeWidth={2.5} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} strokeWidth={2.5} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <View className="w-full max-w-3xl mx-auto">
        <View className="flex-row items-center mx-4 my-3 px-4 rounded-2xl h-14 border border-border bg-muted">
          <Search
            color={THEME.light.mutedForeground}
            size={20}
            style={{ marginRight: 8 }}
          />
          <Input
            className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
            placeholder="Search by file name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="muted-foreground"
          />
          {searchQuery ? (
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSearchQuery("");
              }}
              className="p-1.5 rounded-full"
              hitSlop={8}
            >
              <X color={THEME.light.mutedForeground} size={18} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              progressBackgroundColor={colors.background}
              refreshing={isFetching}
              onRefresh={onRefresh}
              tintColor={colors.foreground}
              colors={[colors.foreground]}
            />
          }
        >
          {filteredAttachments.length === 0 ? (
            <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
              <ImageIcon
                color={colors.mutedForeground}
                size={48}
                strokeWidth={1.5}
                style={{ marginBottom: 16 }}
              />
              <Text className="text-xl font-semibold text-muted-foreground mb-2">
                {searchQuery.trim() ? "No matching attachments" : "No attachments"}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {searchQuery.trim()
                  ? "Try a different search"
                  : "Files in your attachments bucket will appear here"}
              </Text>
            </View>
          ) : viewMode === "grid" ? (
            <View className="w-full max-w-2xl mx-auto">
              {(() => {
                const maxWidth = 672;
                const containerPadding = 16;
                const gap = 8; // half of 16 so column gap matches edge feel (card padding 8+8)
                const rowGap = 16;
                const availableWidth =
                  Math.min(screenWidth, maxWidth) - containerPadding * 2;
                const cardWidth =
                  (availableWidth - gap * (columns - 1)) / columns;
                const totalWidth = cardWidth * columns + gap * (columns - 1);
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "flex-start",
                      width: totalWidth,
                      alignSelf: "center",
                    }}
                  >
                    {filteredAttachments.map((item, index) => {
                      const marginRight =
                        index % columns < columns - 1 ? gap : 0;
                      const marginBottom = rowGap;
                      return (
                        <View
                          key={item.path}
                          style={{
                            width: cardWidth,
                            marginRight,
                            marginBottom,
                          }}
                        >
                          <AttachmentCard
                            item={item}
                            cardWidth={cardWidth}
                            variant="grid"
                            formatFileSize={formatFileSize}
                            onPress={() => openActionModal(item)}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          ) : (
            <View className="w-full max-w-2xl mx-auto">
              {(() => {
                const maxWidth = 672;
                const containerPadding = 16;
                const listGap = 12; // same as files list view
                const availableWidth =
                  Math.min(screenWidth, maxWidth) - containerPadding * 2;
                const cardWidth = availableWidth;
                return (
                  <View style={{ width: cardWidth, alignSelf: "center" }}>
                    {filteredAttachments.map((item, index) => (
                      <View
                        key={item.path}
                        style={{
                          marginBottom:
                            index < filteredAttachments.length - 1 ? listGap : 0,
                        }}
                      >
                        <AttachmentCard
                          item={item}
                          cardWidth={cardWidth}
                          variant="list"
                          formatFileSize={formatFileSize}
                          onPress={() => openActionModal(item)}
                        />
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}
        </ScrollView>
      )}

      {/* Action modal: Delete (left), Cancel (center), Copy URL (right) */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && selectedAttachment && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setDeleteDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text
                numberOfLines={2}
                className="mb-2 text-lg font-semibold text-foreground"
              >
                {selectedAttachment?.name ?? "Attachment"}
              </Text>
              <Text className="mb-5 text-sm leading-5 text-muted-foreground">
                Click "Copy URL" to copy the URL to the clipboard. Delete is
                permanent and cannot be recovered.
              </Text>
              <View className="flex-row items-center justify-between">
                <Pressable
                  className="pr-4 py-2"
                  onPress={() => {
                    confirmDelete();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Text className="font-semibold text-red-500">
                    Delete
                  </Text>
                </Pressable>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    className="px-4 py-2"
                    onPress={() => setDeleteDialogOpen(false)}
                  >
                    <Text className="text-foreground">Cancel</Text>
                  </Pressable>
                  <Pressable
                    className="px-4 py-2"
                    onPress={async () => {
                      await handleCopyLink(selectedAttachment);
                      setDeleteDialogOpen(false);
                      setSelectedAttachment(null);
                    }}
                  >
                    <Text className="font-semibold text-blue-500">
                      Copy URL
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={deleteDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setDeleteDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
                {selectedAttachment && (
                  <>
                    <Text
                      numberOfLines={2}
                      className="mb-2 text-lg font-semibold text-foreground"
                    >
                      {selectedAttachment?.name ?? "Attachment"}
                    </Text>
                    <Text className="mb-5 text-sm leading-5 text-muted-foreground">
                      Click "Copy URL" to copy the URL to the clipboard. Delete is
                      permanent and cannot be recovered.
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <Pressable
                        className="pr-4 py-2"
                        onPress={() => {
                          confirmDelete();
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Text className="font-semibold text-red-500">
                          Delete
                        </Text>
                      </Pressable>
                      <View className="flex-row items-center gap-3">
                        <Pressable
                          className="px-4 py-2"
                          onPress={() => setDeleteDialogOpen(false)}
                        >
                          <Text className="text-foreground">Cancel</Text>
                        </Pressable>
                        <Pressable
                          className="px-4 py-2"
                          onPress={async () => {
                            await handleCopyLink(selectedAttachment);
                            setDeleteDialogOpen(false);
                            setSelectedAttachment(null);
                          }}
                        >
                          <Text className="font-semibold text-blue-500">
                            Copy URL
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

interface AttachmentCardProps {
  item: AttachmentBucketItem;
  cardWidth: number;
  variant: "grid" | "list";
  formatFileSize: (bytes: number) => string;
  onPress: () => void;
}

function AttachmentCard({
  item,
  cardWidth,
  variant,
  formatFileSize,
  onPress,
}: AttachmentCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: variant === "grid" ? 0.96 : 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
    }).start();
  };

  const isGrid = variant === "grid";
  const listIconSize = 56;
  const listCardHeight = 80;
  const imageRadius = 10;
  // Grid: 1:1 square image, no folded corner
  const padding = 8;
  const size = cardWidth - padding * 2;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {isGrid ? (
          <View className="mb-3 items-center">
            <View
              className="bg-muted rounded overflow-hidden relative"
              style={{ width: size, height: size }}
            >
              <Image
                source={{ uri: item.url }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: size,
                  height: size,
                }}
                contentFit="cover"
                recyclingKey={item.url}
              />
            </View>
            {/* File info below icon (same as /files) */}
            <View
              className="mt-2 items-center"
              style={{ width: cardWidth }}
            >
              <Text
                numberOfLines={1}
                className="text-xs font-medium text-foreground text-center"
              >
                {item.name}
              </Text>
              <Text className="text-[10px] text-muted-foreground mt-0.5">
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>
        ) : (
          <View
            className="flex-row items-center p-3 gap-3 bg-muted border border-border rounded-xl"
            style={{ width: cardWidth, height: listCardHeight }}
          >
            <View
              className="bg-background overflow-hidden"
              style={{
                width: listIconSize,
                height: listIconSize,
                borderRadius: imageRadius,
              }}
            >
              <Image
                source={{ uri: item.url }}
                style={{ width: listIconSize, height: listIconSize }}
                contentFit="cover"
                recyclingKey={item.url}
              />
            </View>
            <View className="flex-1 justify-center gap-1">
              <Text
                numberOfLines={1}
                className="text-sm font-semibold text-foreground"
              >
                {item.name}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-[11px] text-muted-foreground uppercase">
                  {(item.contentType?.split("/").pop() ?? "file").slice(0, 8)}
                </Text>
                <Text className="text-[11px] text-muted-foreground">•</Text>
                <Text className="text-[11px] text-muted-foreground">
                  {formatFileSize(item.sizeBytes)}
                </Text>
                <Text className="text-[11px] text-muted-foreground">•</Text>
                <Text className="text-[11px] text-muted-foreground">
                  {formatDate(item.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
