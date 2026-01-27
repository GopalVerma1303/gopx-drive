"use client";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useNetwork } from "@/contexts/network-context";
import { getQueuedMutations, getLastSyncTime } from "@/lib/offline-storage";
import { syncQueuedMutations } from "@/lib/offline-sync";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Cloud, CloudOff, RefreshCw, Wifi, WifiOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SyncScreen() {
  const { isOffline, isConnected, isInternetReachable } = useNetwork();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

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

  const isSmallScreen = screenWidth < 768;

  // Query for pending mutations
  const {
    data: pendingMutations = [],
    isLoading: mutationsLoading,
    refetch: refetchMutations,
    isFetching: mutationsFetching,
  } = useQuery({
    queryKey: ["pendingMutations"],
    queryFn: async () => {
      const mutations = await getQueuedMutations();
      return mutations;
    },
    refetchInterval: 2000, // Refetch every 2 seconds to keep it updated
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Query for last sync time
  const {
    data: lastSyncTime,
    refetch: refetchLastSync,
  } = useQuery({
    queryKey: ["lastSyncTime"],
    queryFn: async () => {
      return await getLastSyncTime();
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncNow = async () => {
    if (isOffline) {
      return;
    }

    setIsSyncing(true);
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const result = await syncQueuedMutations(queryClient);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          result.success > 0
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error
        );
      }
      // Refetch mutations to update the count
      await refetchMutations();
      await refetchLastSync();
    } catch (error) {
      console.error("Error syncing:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Promise.all([refetchMutations(), refetchLastSync()]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Calculate estimated data size for pending mutations
  const estimatePendingDataSize = (): number => {
    let totalSize = 0;
    pendingMutations.forEach((mutation) => {
      if (mutation.resource === "file" && mutation.type === "create") {
        // Estimate file size from mutation data
        const fileSize = mutation.data?.file?.size || 0;
        totalSize += fileSize;
      } else if (mutation.resource === "note" && mutation.type === "create") {
        // Estimate note size (title + content)
        const titleSize = (mutation.data?.title || "").length;
        const contentSize = (mutation.data?.content || "").length;
        totalSize += titleSize + contentSize;
      } else if (mutation.resource === "event" && mutation.type === "create") {
        // Estimate event size
        const titleSize = (mutation.data?.title || "").length;
        const descSize = (mutation.data?.description || "").length;
        totalSize += titleSize + descSize;
      }
    });
    return totalSize;
  };

  const pendingDataSize = estimatePendingDataSize();
  const pendingCount = pendingMutations.length;

  return (
    <View
      className="flex-1 w-full mx-auto"
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
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
            {isSmallScreen && (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push("/(app)/settings");
                }}
                style={{ padding: 8, marginRight: 8 }}
              >
                <ArrowLeft color={colors.foreground} size={24} />
              </Pressable>
            )}
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              Sync
            </Text>
          </View>

          {!isOffline && pendingCount > 0 && (
            <Pressable
              onPress={handleSyncNow}
              disabled={isSyncing}
              style={{
                padding: 8,
                opacity: isSyncing ? 0.5 : 1,
              }}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <RefreshCw color={colors.foreground} size={22} strokeWidth={2.5} />
              )}
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerClassName="p-4 pb-32"
        refreshControl={
          <RefreshControl
            progressBackgroundColor={colors.background}
            refreshing={mutationsFetching}
            onRefresh={onRefresh}
            tintColor={colors.foreground}
            colors={[colors.foreground]}
          />
        }
      >
        <View className="w-full max-w-2xl mx-auto">
          {/* Network Status Card */}
          <Card
            className="rounded-2xl bg-muted border border-border p-6 mb-4"
            style={{
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {isOffline ? (
                  <WifiOff color="#ef4444" size={24} strokeWidth={2.5} />
                ) : (
                  <Wifi color="#22c55e" size={24} strokeWidth={2.5} />
                )}
                <View>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: colors.foreground,
                      marginBottom: 4,
                    }}
                  >
                    {isOffline ? "Offline" : "Online"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.mutedForeground,
                    }}
                  >
                    {isOffline
                      ? "No internet connection"
                      : isConnected && isInternetReachable
                        ? "Connected to internet"
                        : "Connection status unknown"}
                  </Text>
                </View>
              </View>
              {isOffline ? (
                <CloudOff color={colors.mutedForeground} size={20} />
              ) : (
                <Cloud color={colors.mutedForeground} size={20} />
              )}
            </View>

            {/* Connection Details */}
            <View
              style={{
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.mutedForeground,
                  }}
                >
                  Last Sync
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: colors.foreground,
                  }}
                >
                  {formatTimeAgo(lastSyncTime)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Pending Sync Card */}
          <Card
            className="rounded-2xl bg-muted border border-border p-6 mb-4"
            style={{
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: colors.foreground,
                    marginBottom: 4,
                  }}
                >
                  Pending Sync
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.mutedForeground,
                  }}
                >
                  {pendingCount === 0
                    ? "All changes synced"
                    : `${pendingCount} item${pendingCount > 1 ? "s" : ""} waiting to sync`}
                </Text>
              </View>
              {pendingCount > 0 && (
                <View
                  style={{
                    backgroundColor: isOffline ? "#ef4444" : "#3b82f6",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#ffffff",
                    }}
                  >
                    {pendingCount}
                  </Text>
                </View>
              )}
            </View>

            {pendingCount > 0 && (
              <>
                <View
                  style={{
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.mutedForeground,
                      }}
                    >
                      Estimated Data Size
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: colors.foreground,
                      }}
                    >
                      {formatFileSize(pendingDataSize)}
                    </Text>
                  </View>
                </View>

                {isOffline && (
                  <View
                    style={{
                      marginTop: 16,
                      padding: 12,
                      backgroundColor: colors.background,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.mutedForeground,
                        textAlign: "center",
                      }}
                    >
                      Changes will sync automatically when you're back online
                    </Text>
                  </View>
                )}
              </>
            )}
          </Card>

          {/* Pending Mutations List */}
          {pendingCount > 0 && (
            <Card
              className="rounded-2xl bg-muted border border-border p-6"
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 16,
                }}
              >
                Pending Changes
              </Text>

              {mutationsLoading ? (
                <View
                  style={{
                    padding: 24,
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="small" color={colors.foreground} />
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {pendingMutations.map((mutation, index) => {
                    const getResourceIcon = () => {
                      switch (mutation.resource) {
                        case "note":
                          return "📝";
                        case "file":
                          return "📁";
                        case "event":
                          return "📅";
                        default:
                          return "📄";
                      }
                    };

                    const getActionText = () => {
                      switch (mutation.type) {
                        case "create":
                          return "Create";
                        case "update":
                          return "Update";
                        case "delete":
                          return "Delete";
                        default:
                          return "Unknown";
                      }
                    };

                    const getResourceName = () => {
                      switch (mutation.resource) {
                        case "note":
                          return "Note";
                        case "file":
                          return "File";
                        case "event":
                          return "Event";
                        default:
                          return "Item";
                      }
                    };

                    const getItemName = () => {
                      if (mutation.type === "delete") {
                        return `Deleted ${getResourceName()}`;
                      }
                      if (mutation.resource === "note") {
                        return mutation.data?.title || "Untitled Note";
                      }
                      if (mutation.resource === "file") {
                        return mutation.data?.file?.name || "Untitled File";
                      }
                      if (mutation.resource === "event") {
                        return mutation.data?.title || "Untitled Event";
                      }
                      return "Unknown Item";
                    };

                    return (
                      <View
                        key={mutation.id}
                        style={{
                          padding: 12,
                          backgroundColor: colors.background,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>
                            {getResourceIcon()}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "500",
                                color: colors.foreground,
                                marginBottom: 4,
                              }}
                            >
                              {getActionText()} {getResourceName()}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.mutedForeground,
                              }}
                              numberOfLines={1}
                            >
                              {getItemName()}
                            </Text>
                          </View>
                          {mutation.retries > 0 && (
                            <View
                              style={{
                                backgroundColor: "#f59e0b",
                                borderRadius: 12,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "600",
                                  color: "#ffffff",
                                }}
                              >
                                Retry {mutation.retries}/{3}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          )}

          {pendingCount === 0 && !mutationsLoading && (
            <View
              style={{
                padding: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Cloud
                color={colors.mutedForeground}
                size={48}
                strokeWidth={1.5}
                style={{ marginBottom: 16 }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                All synced!
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                  textAlign: "center",
                }}
              >
                All your changes have been synced to the cloud
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
