"use client";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { Tag } from "@/lib/supabase-tags";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useEffect, useState } from "react";

interface TagModalProps {
  open: boolean;
  onClose: () => void;
  tag: Tag | null;
  onCreate: (input: { user_id: string; name: string }) => void;
  onUpdate: (params: { id: string; updates: Partial<Pick<Tag, "name">> }) => void;
  onDelete: (id: string) => void;
  userId: string;
}

export function TagModal({
  open,
  onClose,
  tag,
  onCreate,
  onUpdate,
  onDelete,
  userId,
}: TagModalProps) {
  const { colors } = useThemeColors();
  const [name, setName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Reset form when modal opens/closes or tag changes
  useEffect(() => {
    if (open) {
      if (tag) {
        setName(tag.name);
      } else {
        setName("");
      }
    }
  }, [open, tag]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a tag name");
      return;
    }

    if (tag) {
      onUpdate({
        id: tag.id,
        updates: {
          name: name.trim(),
        },
      });
    } else {
      onCreate({
        user_id: userId,
        name: name.trim(),
      });
    }
  };

  const handleDelete = () => {
    if (!tag) return;
    if (Platform.OS === "web") {
      setDeleteDialogOpen(true);
    } else {
      Alert.alert("Delete Tag", `Are you sure you want to delete "${tag.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(tag.id);
          },
        },
      ]);
    }
  };

  const handleDeleteConfirm = () => {
    if (tag) {
      onDelete(tag.id);
      setDeleteDialogOpen(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {Platform.OS === "web" ? (
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
            onPress={onClose}
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
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "600",
                marginBottom: 20,
              }}
            >
              {tag ? "Edit Tag" : "Create Tag"}
            </Text>

            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                }}
              >
                Name
              </Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Tag name"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              {tag && (
                <Pressable
                  onPress={handleDelete}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 6,
                    backgroundColor: "transparent",
                  }}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
              )}
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                <Pressable
                  onPress={onClose}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: "#3b82f6", fontWeight: "600" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <KeyboardAvoidingView
            style={{
              flex: 1,
            }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
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
                  pointerEvents="box-none"
                />
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 20,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  pointerEvents="box-none"
                >
                  <Pressable
                    onPress={(e) => e.stopPropagation()}
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
                        fontSize: 20,
                        fontWeight: "600",
                        marginBottom: 20,
                      }}
                    >
                      {tag ? "Edit Tag" : "Create Tag"}
                    </Text>

                    <View style={{ marginBottom: 24 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: "500",
                          marginBottom: 8,
                        }}
                      >
                        Name
                      </Text>
                      <Input
                        value={name}
                        onChangeText={setName}
                        placeholder="Tag name"
                        style={{
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.foreground,
                        }}
                      />
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      {tag && (
                        <Pressable
                          onPress={handleDelete}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 6,
                            backgroundColor: "transparent",
                          }}
                        >
                          <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                            Delete
                          </Text>
                        </Pressable>
                      )}
                      <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                        <Pressable
                          onPress={onClose}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: colors.foreground }}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleSave}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: "#3b82f6", fontWeight: "600" }}>Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                </ScrollView>
              </BlurView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Delete Confirmation Dialog - TagModal */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && tag && (
          <View
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 60,
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
                Delete Tag
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete "{tag.name}"? This action
                cannot be undone.
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
                  onPress={handleDeleteConfirm}
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
                pointerEvents="box-none"
              />
              <Pressable
                onPress={(e) => e.stopPropagation()}
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
                  Delete Tag
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginBottom: 24,
                  }}
                >
                  Are you sure you want to delete "{tag?.name}"? This action
                  cannot be undone.
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
                    onPress={handleDeleteConfirm}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                      Delete
                    </Text>
                    </Pressable>
                  </View>
                </Pressable>
              </BlurView>
            </View>
          </Modal>
        )}
    </>
  );
}
