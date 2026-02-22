"use client";

import { Text } from "@/components/ui/text";
import {
  DEFAULT_PREFERENCES,
  getToolbarPreferences,
  saveToolbarPreferences,
  type ToolbarItemId,
  type ToolbarPreferences,
} from "@/lib/toolbar-preferences";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Bold,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Code2,
  Hash,
  Image,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  RotateCcw,
  RotateCw,
  Sparkles,
  Strikethrough,
  Table,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ToolbarItem {
  id: ToolbarItemId;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const TOOLBAR_ITEMS: Record<ToolbarItemId, ToolbarItem> = {
  undo: { id: "undo", label: "Undo", icon: RotateCcw },
  redo: { id: "redo", label: "Redo", icon: RotateCw },
  bold: { id: "bold", label: "Bold", icon: Bold },
  italic: { id: "italic", label: "Italic", icon: Italic },
  strikethrough: { id: "strikethrough", label: "Strikethrough", icon: Strikethrough },
  heading: { id: "heading", label: "Heading", icon: Hash },
  inlineCode: { id: "inlineCode", label: "Inline Code", icon: Code },
  indent: { id: "indent", label: "Indent", icon: IndentIncrease },
  outdent: { id: "outdent", label: "Outdent", icon: IndentDecrease },
  quote: { id: "quote", label: "Quote", icon: Quote },
  link: { id: "link", label: "Link", icon: Link },
  image: { id: "image", label: "Image", icon: Image },
  bulletList: { id: "bulletList", label: "Bullet List", icon: List },
  numberedList: { id: "numberedList", label: "Numbered List", icon: ListOrdered },
  taskList: { id: "taskList", label: "Task List", icon: ListChecks },
  codeBlock: { id: "codeBlock", label: "Code Block", icon: Code2 },
  table: { id: "table", label: "Table", icon: Table },
  horizontalRule: { id: "horizontalRule", label: "Horizontal Rule", icon: Minus },
  date: { id: "date", label: "Date", icon: Calendar },
  aiAssistant: { id: "aiAssistant", label: "AI Assistant", icon: Sparkles },
};

export default function ToolbarOrderScreen() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<ToolbarPreferences>(DEFAULT_PREFERENCES);
  const [initialPreferences, setInitialPreferences] = useState<ToolbarPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getToolbarPreferences();
      setPreferences(prefs);
      setInitialPreferences(prefs);
    } catch (error) {
      console.error("Error loading toolbar preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isSameAsInitial = (prefs: ToolbarPreferences): boolean => {
    // Compare visible arrays (order matters)
    if (prefs.visible.length !== initialPreferences.visible.length) {
      return false;
    }
    for (let i = 0; i < prefs.visible.length; i++) {
      if (prefs.visible[i] !== initialPreferences.visible[i]) {
        return false;
      }
    }
    // Compare hidden arrays (order doesn't matter, but we'll check length and content)
    if (prefs.hidden.length !== initialPreferences.hidden.length) {
      return false;
    }
    const hiddenSet = new Set(prefs.hidden);
    const initialHiddenSet = new Set(initialPreferences.hidden);
    if (hiddenSet.size !== initialHiddenSet.size) {
      return false;
    }
    for (const item of hiddenSet) {
      if (!initialHiddenSet.has(item)) {
        return false;
      }
    }
    return true;
  };

  const hasUnsavedChanges = !isSameAsInitial(preferences);

  const savePreferences = async (newPreferences: ToolbarPreferences) => {
    try {
      await saveToolbarPreferences(newPreferences);
      setPreferences(newPreferences);
      setInitialPreferences(newPreferences);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error saving toolbar preferences:", error);
    }
  };

  const handleSave = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await savePreferences(preferences);
  };

  const isSameAsDefault = (prefs: ToolbarPreferences): boolean => {
    // Compare visible arrays (order matters)
    if (prefs.visible.length !== DEFAULT_PREFERENCES.visible.length) {
      return false;
    }
    for (let i = 0; i < prefs.visible.length; i++) {
      if (prefs.visible[i] !== DEFAULT_PREFERENCES.visible[i]) {
        return false;
      }
    }
    // Compare hidden arrays (order doesn't matter, but we'll check length and content)
    if (prefs.hidden.length !== DEFAULT_PREFERENCES.hidden.length) {
      return false;
    }
    const hiddenSet = new Set(prefs.hidden);
    const defaultHiddenSet = new Set(DEFAULT_PREFERENCES.hidden);
    if (hiddenSet.size !== defaultHiddenSet.size) {
      return false;
    }
    for (const item of hiddenSet) {
      if (!defaultHiddenSet.has(item)) {
        return false;
      }
    }
    return true;
  };

  const handleReset = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPreferences(DEFAULT_PREFERENCES);
  };

  const isDefaultStructure = isSameAsDefault(preferences);

  const moveToHidden = (itemId: ToolbarItemId) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newVisible = preferences.visible.filter((id) => id !== itemId);
    const newHidden = [...preferences.hidden, itemId];
    setPreferences({ visible: newVisible, hidden: newHidden });
  };

  const moveToVisible = (itemId: ToolbarItemId) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newHidden = preferences.hidden.filter((id) => id !== itemId);
    const newVisible = [...preferences.visible, itemId];
    setPreferences({ visible: newVisible, hidden: newHidden });
  };

  const moveItemUp = (index: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const visible = preferences.visible;
    const newVisible =
      index === 0
        ? [...visible.slice(1), visible[0]]
        : (() => {
          const next = [...visible];
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
          return next;
        })();
    setPreferences({ ...preferences, visible: newVisible });
  };

  const moveItemDown = (index: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const visible = preferences.visible;
    const last = visible.length - 1;
    const newVisible =
      index === last
        ? [visible[last], ...visible.slice(0, last)]
        : (() => {
          const next = [...visible];
          [next[index], next[index + 1]] = [next[index + 1], next[index]];
          return next;
        })();
    setPreferences({ ...preferences, visible: newVisible });
  };

  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
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
            paddingHorizontal: 6,
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
              style={{ padding: 8 }}
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
              Toolbar Order
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingRight: 8 }}>
            <Pressable
              onPress={handleReset}
              disabled={isDefaultStructure}
              style={{ paddingVertical: 8, opacity: isDefaultStructure ? 0.4 : 1 }}
            >
              <RotateCcw
                color={colors.foreground}
                size={22}
                strokeWidth={2.5}
              />
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!hasUnsavedChanges}
              style={{ paddingVertical: 8, opacity: !hasUnsavedChanges ? 0.4 : 1 }}
            >
              <Check
                color={colors.foreground}
                size={22}
                strokeWidth={2.5}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(48, insets.bottom + 48),
          gap: 24,
        }}
      >
        {/* Visible Section */}
        <View className="w-full max-w-2xl mx-auto">
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.mutedForeground,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Visible
          </Text>
          {preferences.visible.length === 0 ? (
            <Text
              style={{
                fontSize: 14,
                color: colors.mutedForeground,
                textAlign: "center",
                paddingVertical: 16,
              }}
            >
              No visible items. Add items from hidden section.
            </Text>
          ) : (
            <View className="bg-muted border border-border rounded-2xl overflow-hidden">
              {preferences.visible.map((itemId, index) => {
                const item = TOOLBAR_ITEMS[itemId];
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <ToolbarOrderItem
                    key={itemId}
                    item={item}
                    index={index}
                    onMoveToHidden={() => moveToHidden(itemId)}
                    onMoveUp={() => moveItemUp(index)}
                    onMoveDown={() => moveItemDown(index)}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* Hidden Section */}
        <View className="w-full max-w-2xl mx-auto">
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.mutedForeground,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Hidden
          </Text>
          {preferences.hidden.length === 0 ? (
            <Text
              style={{
                fontSize: 14,
                color: colors.mutedForeground,
                textAlign: "center",
                paddingVertical: 16,
              }}
            >
              No hidden items.
            </Text>
          ) : (
            <View className="bg-muted border border-border rounded-2xl overflow-hidden">
              {preferences.hidden.map((itemId, index) => {
                const item = TOOLBAR_ITEMS[itemId];
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <Pressable
                    key={itemId}
                    className={`flex flex-row items-center gap-12 p-4 ${index > 0 ? "border-t border-border" : ""}`}
                  >
                    <View className="flex flex-row items-center gap-2 flex-1">
                      <Icon color={colors.foreground} size={20} />
                      <Text
                        style={{
                          fontSize: 16,
                          color: colors.foreground,
                          fontWeight: "500",
                        }}
                      >
                        {item.label}
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        moveToVisible(itemId);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Plus color="#3b82f6" size={20} strokeWidth={2} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface ToolbarOrderItemProps {
  item: ToolbarItem;
  index: number;
  onMoveToHidden: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ToolbarOrderItem({
  item,
  index,
  onMoveToHidden,
  onMoveUp,
  onMoveDown,
}: ToolbarOrderItemProps) {
  const { colors } = useThemeColors();
  const Icon = item.icon;

  return (
    <Pressable
      className={`flex flex-row items-center gap-12 p-4 ${index > 0 ? "border-t border-border" : ""}`}
    >
      <View className="flex flex-row items-center gap-2 flex-1">
        <Icon color={colors.foreground} size={20} />
        <Text
          style={{
            fontSize: 16,
            color: colors.foreground,
            fontWeight: "500",
          }}
        >
          {item.label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          style={{ padding: 4 }}
        >
          <ChevronUp
            color={colors.foreground}
            size={20}
          />
        </Pressable>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          style={{ padding: 4 }}
        >
          <ChevronDown
            color={colors.foreground}
            size={20}
          />
        </Pressable>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onMoveToHidden();
          }}
          style={{ padding: 4 }}
        >
          <X color="#ef4444" size={20} />
        </Pressable>
      </View>
    </Pressable>
  );
}
