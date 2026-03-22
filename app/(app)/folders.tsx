"use client";

import { FolderCard } from "@/components/folder-card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useViewMode } from "@/contexts/view-mode-context";
import {
  archiveFolder,
  createFolder,
  listFolders,
  updateFolder,
} from "@/lib/folders";
import { CARD_LIST_MAX_WIDTH, NAV_BAR_HEIGHT } from "@/lib/layout";
import { invalidateFoldersQueries } from "@/lib/query-utils";
import type { Folder } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { LayoutGrid, Plus, Rows2, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const columns = 2;

export default function FoldersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { getViewMode, toggleViewMode } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderNameInput, setEditFolderNameInput] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return window.innerWidth;
      }
    }
    return Dimensions.get("window").width;
  });

  const viewMode = getViewMode("folders");

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

  const folderModalOpen = createFolderModalOpen || !!editingFolder;
  useEffect(() => {
    if (!folderModalOpen) setKeyboardVisible(false);
  }, [folderModalOpen]);

  useEffect(() => {
    if (Platform.OS === "web" || !folderModalOpen) return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [folderModalOpen]);

  const {
    data: folders = [],
    isLoading: foldersLoading,
    refetch: refetchFolders,
    isFetching: foldersFetching,
  } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - match notes
    placeholderData: (prev) => prev,
    retry: 2, // Retry when API fails and no cache (e.g. session not ready right after login)
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      createFolder({ user_id: user!.id, name: name.trim() || "Unnamed folder" }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFolderNameInput("");
      setCreateFolderModalOpen(false);
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateFolder(id, { name }, { userId: user?.id }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEditFolderModal();
    },
  });

  const archiveFolderMutation = useMutation({
    mutationFn: (id: string) => archiveFolder(id, { userId: user?.id }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setArchiveDialogOpen(false);
      closeEditFolderModal();
    },
  });

  const filteredFolders = folders
    .filter((folder) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  const openEditFolderModal = (folder: Folder) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEditingFolder(folder);
    setEditFolderNameInput(folder.name);
  };

  const closeEditFolderModal = () => {
    setEditingFolder(null);
    setEditFolderNameInput("");
  };

  const handleSaveFolder = () => {
    if (!editingFolder) return;
    const name = editFolderNameInput.trim();
    if (!name) return;
    updateFolderMutation.mutate({ id: editingFolder.id, name });
  };

  const openArchiveConfirm = () => {
    if (editingFolder) {
      setArchiveDialogOpen(true);
    }
  };

  const handleArchiveConfirm = () => {
    if (editingFolder) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      archiveFolderMutation.mutate(editingFolder.id);
    }
  };

  const onRefreshFolders = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetchFolders();
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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
            paddingHorizontal: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingLeft: 8 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              Folder
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingRight: 8,
            }}
          >
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                toggleViewMode("folders");
              }}
              style={{ paddingVertical: 8 }}
            >
              {viewMode === "grid" ? (
                <Rows2 color={colors.foreground} size={22} />
              ) : (
                <LayoutGrid color={colors.foreground} size={22} />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                setFolderNameInput("");
                setCreateFolderModalOpen(true);
              }}
              style={{ paddingVertical: 8 }}
            >
              <Plus color={colors.foreground} size={22} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Create Folder Modal */}
      {Platform.OS === "web" ? (
        createFolderModalOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={() => setCreateFolderModalOpen(false)} />
            <Pressable className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg" onPress={(e) => e.stopPropagation()}>
              <Text className="mb-5 text-xl font-semibold text-foreground">
                Create folder
              </Text>
              <View className="mb-6">
                <Text className="mb-2 text-sm font-medium text-foreground">
                  Name
                </Text>
                <Input
                  value={folderNameInput}
                  onChangeText={setFolderNameInput}
                  placeholder="Folder name"
                  className="border-border bg-background text-foreground"
                />
              </View>
              <View className="flex-row justify-end gap-3">
                <Pressable className="rounded-md px-4 py-2.5" onPress={() => setCreateFolderModalOpen(false)}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md py-2.5 pl-4"
                  onPress={() => {
                    const name = folderNameInput.trim();
                    if (!name) return;
                    createFolderMutation.mutate(name);
                  }}
                  disabled={createFolderMutation.isPending}
                >
                  <Text className="font-semibold text-blue-500">
                    {createFolderMutation.isPending ? "Creating…" : "Create"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        )
      ) : (
        <Modal
          visible={createFolderModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCreateFolderModalOpen(false)}
        >
          <KeyboardAvoidingView
            className="flex-1"
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            enabled={keyboardVisible}
          >
            <View className="flex-1 bg-black/50">
              <View className="flex-1 p-4">
                <Pressable className="absolute inset-0" onPress={() => setCreateFolderModalOpen(false)} />
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 20,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Pressable
                    className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg"
                    onPress={(e) => e.stopPropagation()}
                  >
                    <Text className="mb-5 text-xl font-semibold text-foreground">
                      Create folder
                    </Text>
                    <View className="mb-6">
                      <Text className="mb-2 text-sm font-medium text-foreground">
                        Name
                      </Text>
                      <Input
                        value={folderNameInput}
                        onChangeText={setFolderNameInput}
                        placeholder="Folder name"
                        className="border-border bg-background text-foreground"
                      />
                    </View>
                    <View className="w-full flex-row justify-between items-center">
                      <Pressable className="rounded-md py-2.5 pr-4" onPress={() => setCreateFolderModalOpen(false)}>
                        <Text className="text-foreground">Cancel</Text>
                      </Pressable>
                      <Pressable
                        className="rounded-md py-2.5 pl-4"
                        onPress={() => {
                          const name = folderNameInput.trim();
                          if (!name) return;
                          createFolderMutation.mutate(name);
                        }}
                        disabled={createFolderMutation.isPending}
                      >
                        <Text className="font-semibold text-blue-500">
                          {createFolderMutation.isPending ? "Creating…" : "Create"}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Edit Folder Modal */}
      {editingFolder ? (
        Platform.OS === "web" ? (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={closeEditFolderModal} />
            <Pressable
              className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="mb-5 text-xl font-semibold text-foreground">
                Edit folder
              </Text>
              <View className="mb-6">
                <Text className="mb-2 text-sm font-medium text-foreground">
                  Name
                </Text>
                <Input
                  value={editFolderNameInput}
                  onChangeText={setEditFolderNameInput}
                  placeholder="Folder name"
                  className="border-border bg-background text-foreground"
                />
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <Pressable onPress={openArchiveConfirm} className="rounded-md px-4 py-2.5">
                  <Text className="font-semibold text-red-500">Archive</Text>
                </Pressable>
                <View className="flex-row gap-3">
                  <Pressable className="rounded-md px-4 py-2.5" onPress={closeEditFolderModal}>
                    <Text className="text-foreground">Cancel</Text>
                  </Pressable>
                  <Pressable className="rounded-md px-4 py-2.5" onPress={handleSaveFolder}>
                    <Text className="font-semibold text-blue-500">Save</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        ) : (
          <Modal
            visible={!!editingFolder}
            transparent
            animationType="fade"
            onRequestClose={closeEditFolderModal}
          >
            <KeyboardAvoidingView
              className="flex-1"
              behavior="padding"
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
              enabled={keyboardVisible}
            >
              <View className="flex-1 bg-black/50">
                <View className="flex-1 p-4">
                  <Pressable className="absolute inset-0" onPress={closeEditFolderModal} />
                  <ScrollView
                    contentContainerStyle={{
                      flexGrow: 1,
                      justifyContent: "center",
                      alignItems: "center",
                      paddingVertical: 20,
                    }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <Pressable
                      className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg"
                      onPress={(e) => e.stopPropagation()}
                    >
                      <Text className="mb-5 text-xl font-semibold text-foreground">
                        Edit folder
                      </Text>
                      <View className="mb-6">
                        <Text className="mb-2 text-sm font-medium text-foreground">
                          Name
                        </Text>
                        <Input
                          value={editFolderNameInput}
                          onChangeText={setEditFolderNameInput}
                          placeholder="Folder name"
                          className="border-border bg-background text-foreground"
                        />
                      </View>
                      <View className="flex-row items-center justify-between gap-3">
                        <Pressable onPress={openArchiveConfirm} className="rounded-md px-4 py-2.5">
                          <Text className="font-semibold text-red-500">Archive</Text>
                        </Pressable>
                        <View className="flex-row gap-3">
                          <Pressable className="rounded-md px-4 py-2.5" onPress={closeEditFolderModal}>
                            <Text className="text-foreground">Cancel</Text>
                          </Pressable>
                          <Pressable className="rounded-md px-4 py-2.5" onPress={handleSaveFolder}>
                            <Text className="font-semibold text-blue-500">Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )
      ) : null}

      {/* Archive confirmation dialog */}
      {Platform.OS === "web" ? (
        archiveDialogOpen && (
          <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setArchiveDialogOpen(false)}
            />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Archive Folder
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{editingFolder?.name}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setArchiveDialogOpen(false)}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                >
                  <Text className="font-semibold text-red-500">
                    Archive
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={archiveDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setArchiveDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable
              className="absolute inset-0"
              onPress={() => setArchiveDialogOpen(false)}
            />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Archive Folder
              </Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to archive "{editingFolder?.name}"? You can restore it from the archive later.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={() => setArchiveDialogOpen(false)}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className="rounded-md px-4 py-2"
                  onPress={handleArchiveConfirm}
                >
                  <Text className="font-semibold text-red-500">
                    Archive
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <View className="flex-1 w-full">
        {/* Search bar */}
        <View className="w-full max-w-3xl mx-auto">
          <View className="flex-row items-center mx-4 my-3 px-4 rounded-2xl h-14 border border-border bg-muted">
            <Search
              className="text-muted border-border mr-2"
              color={THEME.light.mutedForeground}
              size={20}
            />
            <Input
              className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
              placeholder="Search folders..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="muted-foreground"
            />
            {searchQuery ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
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

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + NAV_BAR_HEIGHT + 32,
          }}
          refreshControl={
            <RefreshControl
              progressBackgroundColor={colors.background}
              refreshing={foldersFetching}
              onRefresh={onRefreshFolders}
              tintColor={colors.foreground}
              colors={[colors.foreground]}
            />
          }
        >
          {foldersLoading ? (
            <View className="flex-1 justify-center items-center py-24">
              <ActivityIndicator size="large" color={colors.foreground} />
            </View>
          ) : filteredFolders.length === 0 ? (
            <View
              className="flex-1 justify-center items-center pt-24 mx-auto"
              style={{ width: "100%", maxWidth: CARD_LIST_MAX_WIDTH }}
            >
              <Text className="text-xl font-semibold text-muted-foreground mb-2">
                {searchQuery ? "No folders found" : "No folders yet"}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {searchQuery
                  ? "Try a different search"
                  : "Tap the + button to create your first folder"}
              </Text>
            </View>
          ) : viewMode === "grid" ? (
            <View className="mx-auto" style={{ width: "100%", maxWidth: CARD_LIST_MAX_WIDTH }}>
              {(() => {
                const containerPadding = 16;
                const columnGap = 12;
                const rowGap = 12;
                const availableWidth = Math.min(screenWidth, CARD_LIST_MAX_WIDTH) - containerPadding * 2;
                const cardWidth = (availableWidth - columnGap * (columns - 1)) / columns;

                const columnHeights = new Array(columns).fill(0);
                const columnsData: Folder[][] = new Array(columns)
                  .fill(null)
                  .map(() => []);

                const folderCardHeight = 150;
                filteredFolders.forEach((folder) => {
                  const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
                  columnsData[shortestColumnIndex].push(folder);
                  columnHeights[shortestColumnIndex] += folderCardHeight + rowGap;
                });

                const totalWidth = cardWidth * columns + columnGap * (columns - 1);

                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      width: totalWidth,
                      alignSelf: "center",
                    }}
                  >
                    {columnsData.map((columnFolders, columnIndex) => (
                      <View
                        key={columnIndex}
                        style={{
                          width: cardWidth,
                          marginRight: columnIndex < columns - 1 ? columnGap : 0,
                        }}
                      >
                        {columnFolders.map((folder, folderIndex) => (
                          <View
                            key={folder.id}
                            style={{
                              marginBottom: folderIndex < columnFolders.length - 1 ? rowGap : 0,
                            }}
                          >
                            <FolderCard
                              folder={folder}
                              cardWidth={cardWidth}
                              variant="grid"
                              onPress={() => {
                                if (Platform.OS !== "web") {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }
                                router.push(
                                  `/(app)/folder/${folder.id}?name=${encodeURIComponent(folder.name)}` as never
                                );
                              }}
                              onDoubleTap={() => openEditFolderModal(folder)}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          ) : (
            <View className="mx-auto" style={{ width: "100%", maxWidth: CARD_LIST_MAX_WIDTH }}>
              {(() => {
                const containerPadding = 16;
                const gap = 12;
                const availableWidth = Math.min(screenWidth, CARD_LIST_MAX_WIDTH) - containerPadding * 2;
                const cardWidth = availableWidth;

                return (
                  <View style={{ width: cardWidth, alignSelf: "center" }}>
                    {filteredFolders.map((folder, folderIndex) => (
                      <View
                        key={folder.id}
                        style={{
                          marginBottom: folderIndex < filteredFolders.length - 1 ? gap : 0,
                        }}
                      >
                        <FolderCard
                          folder={folder}
                          cardWidth={cardWidth}
                          onPress={() => {
                            if (Platform.OS !== "web") {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            router.push(
                              `/(app)/folder/${folder.id}?name=${encodeURIComponent(folder.name)}` as never
                            );
                          }}
                          onDoubleTap={() => openEditFolderModal(folder)}
                        />
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
