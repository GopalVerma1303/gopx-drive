"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "@/lib/folders";
import { invalidateFilesQueries, invalidateFoldersQueries, invalidateNotesQueries } from "@/lib/query-utils";
import type { Folder as FolderType } from "@/lib/supabase";
import { DEFAULT_FOLDER_ID } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import {
  Folder,
  FolderOpen,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FoldersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);

  const {
    data: folders = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: () => listFolders(user?.id),
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createFolder({ user_id: user!.id, name: name || "Untitled folder" }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreateModalOpen(false);
      setNewFolderName("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateFolder(id, { name }),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditModalOpen(false);
      setEditingFolder(null);
      setEditName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      invalidateFoldersQueries(queryClient, user?.id);
      invalidateNotesQueries(queryClient, user?.id);
      invalidateFilesQueries(queryClient, user?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMenuOpenForId(null);
    },
  });

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await refetch();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    createMutation.mutate(newFolderName.trim());
  };

  const handleEdit = (folder: FolderType) => {
    setEditingFolder(folder);
    setEditName(folder.name);
    setEditModalOpen(true);
    setMenuOpenForId(null);
  };

  const handleSaveEdit = () => {
    if (!editingFolder || !editName.trim()) return;
    updateMutation.mutate({ id: editingFolder.id, name: editName.trim() });
  };

  const handleDelete = (folder: FolderType) => {
    setMenuOpenForId(null);
    Alert.alert(
      "Delete folder",
      `Delete "${folder.name}"? Notes and files in this folder will move to Default.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(folder.id),
        },
      ]
    );
  };

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
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: colors.foreground,
            }}
          >
            Folders
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              setNewFolderName("");
              setCreateModalOpen(true);
            }}
            style={{ padding: 8 }}
          >
            <Plus color={colors.foreground} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
      <View className="w-full flex-1">
        <View className="w-full max-w-2xl mx-auto">
          <View className="flex-row items-center mx-4 my-3 px-4 rounded-2xl h-14 border border-border bg-muted">
            <Search
              className="text-muted border-border mr-2"
              color={colors.mutedForeground}
              size={20}
            />
            <Input
              className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
              placeholder="Search folders..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="muted-foreground"
            />
          </View>
        </View>
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
            <View className="w-full max-w-2xl mx-auto">
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push("/(app)/folders/default");
                }}
                style={{ marginBottom: 12 }}
              >
                <Card
                  className="rounded-2xl bg-muted border border-border p-4 flex-row items-center"
                  style={{ padding: 16 }}
                >
                  <FolderOpen
                    color={colors.mutedForeground}
                    size={24}
                    strokeWidth={2}
                    style={{ marginRight: 12 }}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.foreground,
                      flex: 1,
                    }}
                  >
                    Default
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.mutedForeground,
                    }}
                  >
                    Unassigned notes & files
                  </Text>
                </Card>
              </Pressable>
              {filteredFolders.length === 0 && !searchQuery ? (
                <View className="items-center pt-12">
                  <Folder
                    color={colors.mutedForeground}
                    size={48}
                    strokeWidth={1.5}
                    style={{ marginBottom: 16 }}
                  />
                  <Text
                    className="text-xl font-semibold text-muted-foreground mb-2"
                    style={{ color: colors.mutedForeground, marginBottom: 8 }}
                  >
                    No folders yet
                  </Text>
                  <Text
                    className="text-sm text-muted-foreground text-center"
                    style={{ color: colors.mutedForeground, textAlign: "center" }}
                  >
                    Tap + to create a folder and organize notes and files.
                  </Text>
                </View>
              ) : (
                filteredFolders.map((folder) => (
                  <View key={folder.id} style={{ marginBottom: 12 }}>
                    <Card
                      className="rounded-2xl bg-muted border border-border p-4 flex-row items-center"
                      style={{ padding: 16 }}
                    >
                      <Pressable
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                        onPress={() => {
                          if (Platform.OS !== "web") {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          router.push(`/(app)/folders/${folder.id}`);
                        }}
                      >
                        <Folder
                          color={colors.mutedForeground}
                          size={24}
                          strokeWidth={2}
                          style={{ marginRight: 12 }}
                        />
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: colors.foreground,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {folder.name}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (Platform.OS !== "web") {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          setMenuOpenForId(menuOpenForId === folder.id ? null : folder.id);
                        }}
                        style={{ padding: 8 }}
                      >
                        <MoreVertical
                          color={colors.mutedForeground}
                          size={20}
                          strokeWidth={2}
                        />
                      </Pressable>
                    </Card>
                    {menuOpenForId === folder.id && (
                      <View
                        style={{
                          marginTop: 4,
                          flexDirection: "row",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Pressable
                          onPress={() => handleEdit(folder)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor: colors.muted,
                            borderRadius: 8,
                          }}
                        >
                          <Pencil size={16} color={colors.foreground} />
                          <Text style={{ marginLeft: 6, color: colors.foreground }}>
                            Edit
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(folder)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor: colors.muted,
                            borderRadius: 8,
                          }}
                        >
                          <Trash2 size={16} color="#ef4444" />
                          <Text style={{ marginLeft: 6, color: "#ef4444" }}>
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Create folder modal */}
      <Modal
        visible={createModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <BlurView
            intensity={20}
            tint="dark"
            style={{
              borderRadius: 12,
              overflow: "hidden",
              width: "100%",
              maxWidth: 400,
            }}
          >
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                padding: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 12,
                }}
              >
                New folder
              </Text>
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChangeText={setNewFolderName}
                style={{
                  marginBottom: 16,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.mutedForeground}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setCreateModalOpen(false)}>
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  disabled={!newFolderName.trim() || createMutation.isPending}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "600",
                      opacity: !newFolderName.trim() || createMutation.isPending ? 0.5 : 1,
                    }}
                  >
                    Create
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Edit folder modal */}
      <Modal
        visible={editModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <BlurView
            intensity={20}
            tint="dark"
            style={{
              borderRadius: 12,
              overflow: "hidden",
              width: "100%",
              maxWidth: 400,
            }}
          >
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                padding: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 12,
                }}
              >
                Rename folder
              </Text>
              <Input
                placeholder="Folder name"
                value={editName}
                onChangeText={setEditName}
                style={{
                  marginBottom: 16,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.mutedForeground}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable onPress={() => setEditModalOpen(false)}>
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdit}
                  disabled={!editName.trim() || updateMutation.isPending}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "600",
                      opacity: !editName.trim() || updateMutation.isPending ? 0.5 : 1,
                    }}
                  >
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}
