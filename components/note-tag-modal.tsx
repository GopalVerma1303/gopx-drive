"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { Tag } from "@/lib/supabase-tags";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useEffect, useState } from "react";

interface NoteTagModalProps {
  open: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  tags: Tag[];
  noteTags: Tag[];
  onSave: (selectedTagIds: Set<string>) => void;
}

export function NoteTagModal({
  open,
  onClose,
  noteId,
  noteTitle,
  tags,
  noteTags,
  onSave,
}: NoteTagModalProps) {
  const { colors } = useThemeColors();
  const [pendingNoteTags, setPendingNoteTags] = useState<Set<string>>(new Set());

  // Initialize pending tags with current note tags when modal opens
  useEffect(() => {
    if (open) {
      setPendingNoteTags(new Set(noteTags.map((t) => t.id)));
    }
  }, [open, noteTags]);

  const handleTogglePendingTag = (tagId: string) => {
    setPendingNoteTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    onSave(pendingNoteTags);
    onClose();
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
              Tags
            </Text>

            {/* Tag Selection */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 12,
                }}
              >
                Select Tags
              </Text>
              <ScrollView
                style={{
                  maxHeight: 200,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 6,
                  backgroundColor: colors.background,
                }}
                nestedScrollEnabled
              >
                      {tags.map((tag, index) => {
                        const isSelected = pendingNoteTags.has(tag.id);
                        return (
                          <Pressable
                            key={tag.id}
                            onPress={() => handleTogglePendingTag(tag.id)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              borderBottomWidth: index < tags.length - 1 ? 1 : 0,
                              borderBottomColor: colors.border,
                            }}
                          >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleTogglePendingTag(tag.id)}
                      />
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          marginLeft: 12,
                        }}
                      >
                        {tag.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {pendingNoteTags.size > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  {Array.from(pendingNoteTags).map((tagId) => {
                    const tag = tags.find((t) => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <Badge
                        key={tagId}
                        variant="default"
                        style={{
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "500",
                          }}
                        >
                          {tag.name}
                        </Text>
                      </Badge>
                    );
                  })}
                </View>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
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
                      Tags
                    </Text>

                    {/* Tag Selection */}
                    <View style={{ marginBottom: 24 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: "500",
                          marginBottom: 12,
                        }}
                      >
                        Select Tags
                      </Text>
                      <ScrollView
                        style={{
                          maxHeight: 200,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 6,
                          backgroundColor: colors.background,
                        }}
                        nestedScrollEnabled
                      >
                        {tags.map((tag, index) => {
                          const isSelected = pendingNoteTags.has(tag.id);
                          return (
                            <Pressable
                              key={tag.id}
                              onPress={() => handleTogglePendingTag(tag.id)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 12,
                                paddingVertical: 12,
                                borderBottomWidth: index < tags.length - 1 ? 1 : 0,
                                borderBottomColor: colors.border,
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleTogglePendingTag(tag.id)}
                              />
                              <Text
                                style={{
                                  color: colors.foreground,
                                  fontSize: 14,
                                  marginLeft: 12,
                                }}
                              >
                                {tag.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      {pendingNoteTags.size > 0 && (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 12,
                          }}
                        >
                          {Array.from(pendingNoteTags).map((tagId) => {
                            const tag = tags.find((t) => t.id === tagId);
                            if (!tag) return null;
                            return (
                              <Badge
                                key={tagId}
                                variant="default"
                                style={{
                                  borderRadius: 999,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "500",
                                  }}
                                >
                                  {tag.name}
                                </Text>
                              </Badge>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        gap: 12,
                      }}
                    >
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
                  </Pressable>
                </ScrollView>
              </BlurView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
}
