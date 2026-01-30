"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import {
  deleteFile,
  listArchivedFiles,
  restoreFile,
} from "@/lib/files";
import {
  deleteNote,
  listArchivedNotes,
  restoreNote,
} from "@/lib/notes";
import type { File as FileRecord, Note } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { Archive, ArrowLeft, Trash2, Undo2 } from "lucide-react-native";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ArchiveScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"notes" | "files">("notes");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
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

  // Confirmation dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<{
    type: "all" | "selected" | "single";
    id?: string;
  } | null>(null);
  const [restoreAction, setRestoreAction] = useState<{
    type: "all" | "selected" | "single";
    id?: string;
  } | null>(null);

  const {
    data: archivedNotes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
    isFetching: notesFetching,
  } = useQuery({
    queryKey: ["archivedNotes", user?.id],
    queryFn: () => listArchivedNotes(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
  });

  const {
    data: archivedFiles = [],
    isLoading: filesLoading,
    refetch: refetchFiles,
    isFetching: filesFetching,
  } = useQuery({
    queryKey: ["archivedFiles", user?.id],
    queryFn: () => listArchivedFiles(user?.id),
    enabled: !!user?.id,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
  });

  const restoreNoteMutation = useMutation({
    mutationFn: (id: string) => restoreNote(id),
    onSuccess: () => {
      // Remove redundant refetch() - invalidateQueries already triggers refetch
      queryClient.invalidateQueries({ queryKey: ["archivedNotes"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      // Remove redundant refetch() - invalidateQueries already triggers refetch
      queryClient.invalidateQueries({ queryKey: ["archivedNotes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const restoreFileMutation = useMutation({
    mutationFn: (id: string) => restoreFile(id),
    onSuccess: () => {
      // Remove redundant refetch() - invalidateQueries already triggers refetch
      queryClient.invalidateQueries({ queryKey: ["archivedFiles"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      // Remove redundant refetch() - invalidateQueries already triggers refetch
      queryClient.invalidateQueries({ queryKey: ["archivedFiles"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleRestoreAll = () => {
    setRestoreAction({ type: "all" });
    setRestoreDialogOpen(true);
  };

  const handleRestoreSelected = () => {
    setRestoreAction({ type: "selected" });
    setRestoreDialogOpen(true);
  };

  const handleDeleteAll = () => {
    setDeleteAction({ type: "all" });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    setDeleteAction({ type: "selected" });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSingle = (id: string) => {
    setDeleteAction({ type: "single", id });
    setDeleteDialogOpen(true);
  };

  const handleRestoreSingle = (id: string) => {
    setRestoreAction({ type: "single", id });
    setRestoreDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteAction) return;

    if (deleteAction.type === "all") {
      if (activeTab === "notes") {
        for (const note of archivedNotes) {
          await deleteNoteMutation.mutateAsync(note.id);
        }
        setSelectedNotes(new Set());
      } else {
        for (const file of archivedFiles) {
          await deleteFileMutation.mutateAsync(file.id);
        }
        setSelectedFiles(new Set());
      }
    } else if (deleteAction.type === "selected") {
      if (activeTab === "notes") {
        for (const id of selectedNotes) {
          await deleteNoteMutation.mutateAsync(id);
        }
        setSelectedNotes(new Set());
      } else {
        for (const id of selectedFiles) {
          await deleteFileMutation.mutateAsync(id);
        }
        setSelectedFiles(new Set());
      }
    } else if (deleteAction.type === "single" && deleteAction.id) {
      if (activeTab === "notes") {
        await deleteNoteMutation.mutateAsync(deleteAction.id);
      } else {
        await deleteFileMutation.mutateAsync(deleteAction.id);
      }
    }

    setDeleteDialogOpen(false);
    setDeleteAction(null);
  };

  const confirmRestore = async () => {
    if (!restoreAction) return;

    if (restoreAction.type === "all") {
      if (activeTab === "notes") {
        for (const note of archivedNotes) {
          await restoreNoteMutation.mutateAsync(note.id);
        }
        setSelectedNotes(new Set());
      } else {
        for (const file of archivedFiles) {
          await restoreFileMutation.mutateAsync(file.id);
        }
        setSelectedFiles(new Set());
      }
    } else if (restoreAction.type === "selected") {
      if (activeTab === "notes") {
        for (const id of selectedNotes) {
          await restoreNoteMutation.mutateAsync(id);
        }
        setSelectedNotes(new Set());
      } else {
        for (const id of selectedFiles) {
          await restoreFileMutation.mutateAsync(id);
        }
        setSelectedFiles(new Set());
      }
    } else if (restoreAction.type === "single" && restoreAction.id) {
      if (activeTab === "notes") {
        await restoreNoteMutation.mutateAsync(restoreAction.id);
      } else {
        await restoreFileMutation.mutateAsync(restoreAction.id);
      }
    }

    setRestoreDialogOpen(false);
    setRestoreAction(null);
  };

  const toggleNoteSelection = (id: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotes(newSelected);
  };

  const toggleFileSelection = (id: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Refresh both queries when user pulls down
    await Promise.all([refetchNotes(), refetchFiles()]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const hasSelection =
    activeTab === "notes" ? selectedNotes.size > 0 : selectedFiles.size > 0;
  const itemCount =
    activeTab === "notes" ? archivedNotes.length : archivedFiles.length;

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
              Archive
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            {itemCount > 0 && (
              <>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Medium
                      );
                    }
                    hasSelection ? handleRestoreSelected() : handleRestoreAll();
                  }}
                  style={{ padding: 8 }}
                >
                  <Undo2 color={colors.foreground} size={22} strokeWidth={2.5} />
                </Pressable>
                {hasSelection ? (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                      handleDeleteSelected();
                    }}
                    style={{ padding: 8 }}
                  >
                    <Trash2 color="#ef4444" size={22} strokeWidth={2.5} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Medium
                        );
                      }
                      handleDeleteAll();
                    }}
                    style={{ padding: 8 }}
                  >
                    <Trash2 color="#ef4444" size={22} strokeWidth={2.5} />
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </View>
      <View className="w-full flex-1">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "notes" | "files")} className="flex-1">
          {/* Tabs Container - styled like search bar */}
          <View className="w-full max-w-2xl mx-auto">
            <View className="flex-row items-center mx-4 my-3 px-4 rounded-2xl h-14 border border-border bg-muted">
              <View style={{ flex: 1, width: "100%" }}>
                <TabsList className="w-full">
                  <TabsTrigger
                    value="notes"
                    style={{
                      flex: 1,
                      backgroundColor: activeTab === "notes" ? colors.foreground + "10" : "transparent",
                    }}
                  >
                    <Text style={{
                      color: activeTab === "notes" ? colors.foreground : colors.mutedForeground
                    }}>
                      Notes
                    </Text>
                  </TabsTrigger>
                  <TabsTrigger
                    value="files"
                    style={{
                      flex: 1,
                      backgroundColor: activeTab === "files" ? colors.foreground + "10" : "transparent",
                    }}
                  >
                    <Text style={{
                      color: activeTab === "files" ? colors.foreground : colors.mutedForeground
                    }}>
                      Files
                    </Text>
                  </TabsTrigger>
                </TabsList>
              </View>
            </View>
          </View>

          <TabsContent value="notes" className="flex-1" style={{ flex: 1 }}>
            {notesLoading ? (
              <View className="flex-1 justify-center items-center" style={{ flex: 1 }}>
                <ActivityIndicator size="large" color={colors.foreground} />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                style={{ flex: 1 }}
                contentContainerClassName="p-4 pb-32"
                refreshControl={
                  <RefreshControl
                    progressBackgroundColor={colors.background}
                    refreshing={notesFetching || filesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {archivedNotes.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Archive
                      color={colors.mutedForeground}
                      size={48}
                      strokeWidth={1.5}
                      style={{ marginBottom: 16 }}
                    />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      No archived notes
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      Notes you archive will appear here
                    </Text>
                  </View>
                ) : (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const maxWidth = 672;
                      const containerPadding = 16;
                      const gap = 16;
                      const availableWidth =
                        Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const cardWidth = availableWidth;

                      return (
                        <View style={{ width: cardWidth, alignSelf: "center" }}>
                          {archivedNotes.map((note, noteIndex) => (
                            <View
                              key={note.id}
                              style={{
                                marginBottom:
                                  noteIndex < archivedNotes.length - 1 ? gap : 0,
                              }}
                            >
                              <ArchivedNoteCard
                                note={note}
                                cardWidth={cardWidth}
                                isSelected={selectedNotes.has(note.id)}
                                onToggleSelect={() =>
                                  toggleNoteSelection(note.id)
                                }
                                onDelete={() =>
                                  handleDeleteSingle(note.id)
                                }
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
          </TabsContent>

          <TabsContent value="files" className="flex-1" style={{ flex: 1 }}>
            {filesLoading ? (
              <View className="flex-1 justify-center items-center" style={{ flex: 1 }}>
                <ActivityIndicator size="large" color={colors.foreground} />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                style={{ flex: 1 }}
                contentContainerClassName="p-4 pb-32"
                refreshControl={
                  <RefreshControl
                    progressBackgroundColor={colors.background}
                    refreshing={notesFetching || filesFetching}
                    onRefresh={onRefresh}
                    tintColor={colors.foreground}
                    colors={[colors.foreground]}
                  />
                }
              >
                {archivedFiles.length === 0 ? (
                  <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                    <Archive
                      color={colors.mutedForeground}
                      size={48}
                      strokeWidth={1.5}
                      style={{ marginBottom: 16 }}
                    />
                    <Text className="text-xl font-semibold text-muted-foreground mb-2">
                      No archived files
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      Files you archive will appear here
                    </Text>
                  </View>
                ) : (
                  <View className="w-full max-w-2xl mx-auto">
                    {(() => {
                      const maxWidth = 672;
                      const containerPadding = 16;
                      const gap = 12;
                      const availableWidth =
                        Math.min(screenWidth, maxWidth) - containerPadding * 2;
                      const cardWidth = availableWidth;

                      return (
                        <View style={{ width: cardWidth, alignSelf: "center" }}>
                          {archivedFiles.map((file: FileRecord, index: number) => (
                            <View
                              key={file.id}
                              style={{
                                marginBottom:
                                  index < archivedFiles.length - 1 ? gap : 0,
                              }}
                            >
                              <ArchivedFileListCard
                                file={file}
                                formatFileSize={formatFileSize}
                                cardWidth={cardWidth}
                                isSelected={selectedFiles.has(file.id)}
                                onToggleSelect={() =>
                                  toggleFileSelection(file.id)
                                }
                                onDelete={() =>
                                  handleDeleteSingle(file.id)
                                }
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
          </TabsContent>
        </Tabs>
      </View>

      {/* Delete Confirmation Dialog */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && (
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
              onPress={() => setDeleteDialogOpen(false)}
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
              <Text
                className="text-lg font-semibold mb-2"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                {deleteAction?.type === "all"
                  ? `Delete All ${activeTab === "notes" ? "Notes" : "Files"}`
                  : deleteAction?.type === "selected"
                    ? `Delete Selected ${activeTab === "notes" ? "Notes" : "Files"}`
                    : `Delete ${activeTab === "notes" ? "Note" : "File"}`}
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                {deleteAction?.type === "all"
                  ? `Are you sure you want to permanently delete all ${activeTab === "notes"
                    ? archivedNotes.length
                    : archivedFiles.length
                  } archived ${activeTab}? This action cannot be undone.`
                  : deleteAction?.type === "selected"
                    ? `Are you sure you want to permanently delete ${activeTab === "notes"
                      ? selectedNotes.size
                      : selectedFiles.size
                    } selected ${activeTab === "notes" ? "note" : "file"}${(activeTab === "notes"
                      ? selectedNotes.size
                      : selectedFiles.size) > 1
                      ? "s"
                      : ""
                    }? This action cannot be undone.`
                    : `Are you sure you want to permanently delete this ${activeTab === "notes" ? "note" : "file"
                    }? This action cannot be undone.`}
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => setDeleteDialogOpen(false)}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={confirmDelete}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
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
                onPress={() => setDeleteDialogOpen(false)}
              />
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
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  {deleteAction?.type === "all"
                    ? `Delete All ${activeTab === "notes" ? "Notes" : "Files"}`
                    : deleteAction?.type === "selected"
                      ? `Delete Selected ${activeTab === "notes" ? "Notes" : "Files"}`
                      : `Delete ${activeTab === "notes" ? "Note" : "File"}`}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginBottom: 24,
                  }}
                >
                  {deleteAction?.type === "all"
                    ? `Are you sure you want to permanently delete all ${activeTab === "notes"
                      ? archivedNotes.length
                      : archivedFiles.length
                    } archived ${activeTab}? This action cannot be undone.`
                    : deleteAction?.type === "selected"
                      ? `Are you sure you want to permanently delete ${activeTab === "notes"
                        ? selectedNotes.size
                        : selectedFiles.size
                      } selected ${activeTab === "notes" ? "note" : "file"}${(activeTab === "notes"
                        ? selectedNotes.size
                        : selectedFiles.size) > 1
                        ? "s"
                        : ""
                      }? This action cannot be undone.`
                      : `Are you sure you want to permanently delete this ${activeTab === "notes" ? "note" : "file"
                      }? This action cannot be undone.`}
                </Text>
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
                    onPress={() => setDeleteDialogOpen(false)}
                  >
                    <Text style={{ color: colors.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                    }}
                    onPress={confirmDelete}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}

      {/* Restore Confirmation Dialog */}
      {Platform.OS === "web" ? (
        restoreDialogOpen && (
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
              onPress={() => setRestoreDialogOpen(false)}
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
              <Text
                className="text-lg font-semibold mb-2"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                {restoreAction?.type === "all"
                  ? `Restore All ${activeTab === "notes" ? "Notes" : "Files"}`
                  : restoreAction?.type === "selected"
                    ? `Restore Selected ${activeTab === "notes" ? "Notes" : "Files"}`
                    : `Restore ${activeTab === "notes" ? "Note" : "File"}`}
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                {restoreAction?.type === "all"
                  ? `Are you sure you want to restore all ${activeTab === "notes"
                    ? archivedNotes.length
                    : archivedFiles.length
                  } archived ${activeTab}?`
                  : restoreAction?.type === "selected"
                    ? `Are you sure you want to restore ${activeTab === "notes"
                      ? selectedNotes.size
                      : selectedFiles.size
                    } selected ${activeTab === "notes" ? "note" : "file"}${(activeTab === "notes"
                      ? selectedNotes.size
                      : selectedFiles.size) > 1
                      ? "s"
                      : ""
                    }?`
                    : `Are you sure you want to restore this ${activeTab === "notes" ? "note" : "file"
                    }?`}
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => setRestoreDialogOpen(false)}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={confirmRestore}
                >
                  <Text style={{ color: "#3b82f6", fontWeight: "600" }}>
                    Restore
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={restoreDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRestoreDialogOpen(false)}
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
                onPress={() => setRestoreDialogOpen(false)}
              />
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
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  {restoreAction?.type === "all"
                    ? `Restore All ${activeTab === "notes" ? "Notes" : "Files"}`
                    : restoreAction?.type === "selected"
                      ? `Restore Selected ${activeTab === "notes" ? "Notes" : "Files"}`
                      : `Restore ${activeTab === "notes" ? "Note" : "File"}`}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginBottom: 24,
                  }}
                >
                  {restoreAction?.type === "all"
                    ? `Are you sure you want to restore all ${activeTab === "notes"
                      ? archivedNotes.length
                      : archivedFiles.length
                    } archived ${activeTab}?`
                    : restoreAction?.type === "selected"
                      ? `Are you sure you want to restore ${activeTab === "notes"
                        ? selectedNotes.size
                        : selectedFiles.size
                      } selected ${activeTab === "notes" ? "note" : "file"}${(activeTab === "notes"
                        ? selectedNotes.size
                        : selectedFiles.size) > 1
                        ? "s"
                        : ""
                      }?`
                      : `Are you sure you want to restore this ${activeTab === "notes" ? "note" : "file"
                      }?`}
                </Text>
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
                    onPress={() => setRestoreDialogOpen(false)}
                  >
                    <Text style={{ color: colors.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                    }}
                    onPress={confirmRestore}
                  >
                    <Text style={{ color: "#3b82f6", fontWeight: "600" }}>
                      Restore
                    </Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}
    </View>
  );
}

interface ArchivedNoteCardProps {
  note: Note;
  cardWidth: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}

function ArchivedNoteCard({
  note,
  cardWidth,
  isSelected,
  onToggleSelect,
  onDelete,
}: ArchivedNoteCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
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

  const handleContextMenu = (e: any) => {
    if (Platform.OS === "web" && onDelete) {
      e.preventDefault();
      onDelete();
    }
  };

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
    return date.toLocaleDateString();
  };

  // Calculate variable card height based on content length for masonry effect
  const padding = 16; // p-4 = 16px
  const contentLength = note.content?.length || 0;
  const titleHeight = 24; // Approximate title height
  const dateHeight = 14; // Approximate date height
  const minContentHeight = 40;
  const maxContentHeight = 120;

  // Calculate content height based on text length (rough estimate)
  // Each character is roughly 6px wide, with line breaks every ~50 chars
  const lines = Math.ceil((contentLength || 0) / 50);
  const contentHeight = Math.min(
    Math.max(minContentHeight, lines * 18),
    maxContentHeight
  );

  // A4 paper aspect ratio: height/width = 297/210 ≈ 1.414
  const a4MaxHeight = cardWidth * 1.414;
  const calculatedHeight = titleHeight + contentHeight + dateHeight + padding * 2 + 8; // +8 for spacing
  const cardHeight = Math.min(calculatedHeight, a4MaxHeight);

  return (
    <Pressable
      onPress={onToggleSelect}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onDelete}
      {...(Platform.OS === "web" && {
        onContextMenu: handleContextMenu,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card
          className="rounded-2xl bg-muted border border-border"
          style={{
            width: cardWidth,
            minHeight: cardHeight,
            maxHeight: a4MaxHeight,
            padding: padding,
            position: "relative",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: padding,
              right: padding,
              zIndex: 10,
            }}
          >
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          </View>
          <Text
            className="text-lg font-semibold text-foreground"
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
          <Text
            className="text-sm text-muted-foreground leading-4"
            numberOfLines={contentLength > 200 ? 8 : 6}
          >
            {note.content ? note.content : "No content"}
          </Text>
          <Text
            className="text-xs text-muted-foreground/70"
            style={{ marginTop: 8 }}
          >
            {formatDate(note.updated_at)}
          </Text>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

interface ArchivedFileCardProps {
  file: FileRecord;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function ArchivedFileCard({
  file,
  formatFileSize,
  cardWidth,
  isSelected,
  onToggleSelect,
}: ArchivedFileCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
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
    return date.toLocaleDateString();
  };

  const padding = 8;
  const fileWidth = cardWidth - padding * 2;
  const fileHeight = (fileWidth / 130) * 150;
  const foldSize = Math.max(20, fileWidth * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onToggleSelect}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          style={{
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: fileWidth,
              height: fileHeight,
              backgroundColor: colors.muted,
              borderWidth: 0,
              borderColor: colors.border,
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                zIndex: 10,
              }}
            >
              <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
            </View>
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: foldSize,
                borderRightWidth: foldSize,
                borderTopColor: colors.background,
                borderRightColor: "transparent",
                borderBottomWidth: 0,
                borderLeftWidth: 0,
                opacity: 1,
                transform: [{ rotate: "90deg" }],
              }}
            />
            <View
              style={{
                flex: 1,
                padding: 12,
                paddingTop: 16,
                paddingRight: foldSize + 4,
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.foreground,
                    marginBottom: 4,
                  }}
                  numberOfLines={2}
                >
                  {file.name.length > 15
                    ? file.name.substring(0, 15) + "..."
                    : file.name}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.mutedForeground,
                    marginTop: 4,
                  }}
                >
                  {file.extension.toUpperCase()}
                </Text>
              </View>
              <View style={{ marginTop: "auto" }}>
                <Text
                  style={{
                    fontSize: 9,
                    color: colors.mutedForeground,
                    opacity: 0.7,
                  }}
                >
                  {formatFileSize(file.file_size)}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={{
              marginTop: 8,
              width: cardWidth,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: colors.foreground,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {file.name}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: colors.mutedForeground,
                  marginTop: 2,
                  textAlign: "center",
                }}
              >
                {formatDate(file.updated_at)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface ArchivedFileListCardProps {
  file: FileRecord;
  formatFileSize: (bytes: number) => string;
  cardWidth: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}

function ArchivedFileListCard({
  file,
  formatFileSize,
  cardWidth,
  isSelected,
  onToggleSelect,
  onDelete,
}: ArchivedFileListCardProps) {
  const { colors } = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
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
    return date.toLocaleDateString();
  };

  const cardHeight = 80;
  const iconSize = 56;
  const padding = 12;
  const foldSize = Math.max(12, iconSize * 0.2);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onToggleSelect}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          style={{
            width: cardWidth,
            height: cardHeight,
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            padding: padding,
            gap: 12,
          }}
        >
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          <View
            style={{
              width: iconSize,
              height: iconSize,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.muted,
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: foldSize,
                borderRightWidth: foldSize,
                borderTopColor: colors.muted,
                borderRightColor: "transparent",
                borderBottomWidth: 0,
                borderLeftWidth: 0,
                opacity: 1,
                transform: [{ rotate: "90deg" }],
              }}
            />
            <View
              style={{
                flex: 1,
                padding: 6,
                paddingTop: 8,
                paddingRight: foldSize + 2,
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
                numberOfLines={1}
              >
                {file.extension.toUpperCase().slice(0, 3)}
              </Text>
              <View style={{ marginTop: "auto" }}>
                <Text
                  style={{
                    fontSize: 6,
                    color: colors.mutedForeground,
                    opacity: 0.7,
                  }}
                >
                  {formatFileSize(file.file_size).split(" ")[0]}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.foreground,
              }}
              numberOfLines={1}
            >
              {file.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                  textTransform: "uppercase",
                }}
              >
                {file.extension}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                •
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                {formatFileSize(file.file_size)}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                •
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                {formatDate(file.updated_at)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
