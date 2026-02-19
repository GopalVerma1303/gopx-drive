import { useThemeColors } from "@/lib/use-theme-colors";
import {
  getToolbarPreferences,
  type ToolbarItemId,
  DEFAULT_PREFERENCES,
} from "@/lib/toolbar-preferences";
import { cn } from "@/lib/utils";
import * as Haptics from "expo-haptics";
import {
  Bold,
  Calendar,
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
  Quote,
  RotateCcw,
  RotateCw,
  Sparkles,
  Strikethrough,
  Table
} from "lucide-react-native";
import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { AppState, AppStateStatus, Platform, Pressable, ScrollView, Text, View } from "react-native";

// Helper function to toggle checkbox in markdown text
export function toggleCheckboxInMarkdown(
  markdown: string,
  lineIndex: number
): string {
  const lines = markdown.split('\n');
  if (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex];
    // Use detectCheckboxInLine to ensure we're using the exact same detection logic
    const checkboxInfo = detectCheckboxInLine(line);

    if (checkboxInfo && checkboxInfo.hasCheckbox) {
      // Get the checkbox info to preserve exact format
      const { prefix, restText, isChecked } = checkboxInfo;

      // Toggle the checkbox state
      const newCheckboxState = isChecked ? ' ' : 'x';

      // Reconstruct the line using the exact format that detectCheckboxInLine expects
      // Format: prefix + " " + "[checkbox]" + (space if restText exists) + restText
      // prefix is indent + listMarker (e.g., "-" or "  -")
      // The detection pattern requires \s+ (one or more spaces) between listMarker and [
      const restTextStr = restText || '';
      // Always add one space after listMarker (required by \s+ in detection pattern)
      // Add one space after ] if restText exists (common markdown format)
      // Don't trim restText to preserve original formatting
      const newLine = restTextStr.length > 0
        ? `${prefix} [${newCheckboxState}] ${restTextStr}`
        : `${prefix} [${newCheckboxState}]`;

      return [
        ...lines.slice(0, lineIndex),
        newLine,
        ...lines.slice(lineIndex + 1),
      ].join('\n');
    }
  }
  return markdown;
}

// Helper function to detect checkbox pattern in a line
export function detectCheckboxInLine(line: string): {
  hasCheckbox: boolean;
  isChecked: boolean;
  prefix: string;
  restText: string;
  fullMatch: string;
} | null {
  // Match checkbox patterns: - [ ], - [x], - [X], - [*], etc.
  // Handles indentation and different list markers
  const checkboxMatch = line.match(/(\s*)([-*+])\s+\[([\s*xX*])\]\s*(.*)$/);
  if (checkboxMatch) {
    const [, indent, listMarker, checkboxState, restText] = checkboxMatch;
    const isChecked = checkboxState === '*' || checkboxState === 'x' || checkboxState === 'X';
    const prefix = indent + listMarker;
    return {
      hasCheckbox: true,
      isChecked,
      prefix,
      restText: restText || '',
      fullMatch: checkboxMatch[0],
    };
  }
  return null;
}

interface MarkdownToolbarProps {
  onInsertText: (text: string, cursorOffset?: number) => void;
  onWrapSelection?: (before: string, after: string, cursorOffset?: number) => void;
  onToggleFormat?: (format: string) => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isPreview?: boolean;
  onAIAssistant?: () => void;
  onImageInsert?: () => void;
}

export function MarkdownToolbar({
  onInsertText,
  onWrapSelection,
  onToggleFormat,
  onIndent,
  onOutdent,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isPreview = false,
  onAIAssistant,
  onImageInsert,
}: MarkdownToolbarProps) {
  const { colors } = useThemeColors();
  const TAB_SPACES = "   ";
  const [visibleItems, setVisibleItems] = useState<ToolbarItemId[]>(
    DEFAULT_PREFERENCES.visible
  );
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadPreferences();

    // Reload preferences when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        loadPreferences();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getToolbarPreferences();
      setVisibleItems(prefs.visible);
    } catch (error) {
      console.error("Error loading toolbar preferences:", error);
    }
  };

  if (isPreview) {
    return null;
  }

  // Filter visible items - exclude aiAssistant if callback is not provided
  const filteredVisibleItems = visibleItems.filter((itemId) => {
    if (itemId === "aiAssistant" && !onAIAssistant) {
      return false;
    }
    return true;
  });

  // Hide toolbar if there are no visible items
  if (filteredVisibleItems.length === 0) {
    return null;
  }

  // Helper to wrap selection or insert text
  const wrapOrInsert = (before: string, after: string, cursorOffset?: number) => {
    if (onWrapSelection) {
      onWrapSelection(before, after, cursorOffset);
    } else {
      onInsertText(before + after, cursorOffset ?? before.length);
    }
  };

  const handleBold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    wrapOrInsert("**", "**", 2); // **|**
  };

  const handleItalic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    wrapOrInsert("*", "*", 1); // *|*
  };

  const handleStrikethrough = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    wrapOrInsert("~~", "~~", 2); // ~~|~~
  };

  const handleHeading = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("# ", 2);
  };

  const handleInlineCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    wrapOrInsert("`", "`", 1); // `|`
  };

  const handleQuote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("> ", 2);
  };

  const handleLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Insert []() with cursor positioned between brackets for link text
    onInsertText("[]()", 1);
  };

  const handleImage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // If onImageInsert callback is provided, open modal; otherwise use default behavior
    if (onImageInsert) {
      onImageInsert();
    } else {
      // Fallback: Insert ![]() with cursor positioned between brackets for alt text
      onInsertText("![]()", 2);
    }
  };

  const handleBulletList = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("- ", 2);
  };

  const handleNumberedList = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("1. ", 3);
  };

  const handleTaskList = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("- [ ] ", 6);
  };

  const handleCodeBlock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("```\n\n```", 4);
  };

  const handleTable = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const table = "| Col1 | Col2 |\n|------|------|\n|      |      |";
    onInsertText(table, table.length);
  };

  const handleHorizontalRule = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onInsertText("\n---\n", 5);
  };

  const handleIndent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onIndent) {
      onIndent();
      return;
    }
    onInsertText(TAB_SPACES, TAB_SPACES.length);
  };

  const handleOutdent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOutdent?.();
  };

  const handleUndo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUndo?.();
  };

  const handleRedo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRedo?.();
  };

  const handleDate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear()).slice(-2);
    const dateString = `${day}/${month}/${year}`;
    onInsertText(dateString, dateString.length);
  };

  const handleAIAssistant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAIAssistant?.();
  };

  // Map item IDs to handlers and icons
  const itemHandlers: Record<ToolbarItemId, () => void> = {
    undo: handleUndo,
    redo: handleRedo,
    bold: handleBold,
    italic: handleItalic,
    strikethrough: handleStrikethrough,
    heading: handleHeading,
    inlineCode: handleInlineCode,
    indent: handleIndent,
    outdent: handleOutdent,
    quote: handleQuote,
    link: handleLink,
    image: handleImage,
    bulletList: handleBulletList,
    numberedList: handleNumberedList,
    taskList: handleTaskList,
    codeBlock: handleCodeBlock,
    table: handleTable,
    horizontalRule: handleHorizontalRule,
    date: handleDate,
    aiAssistant: handleAIAssistant,
  };

  const itemIcons: Record<ToolbarItemId, React.ComponentType<{ size?: number; color?: string }>> = {
    undo: RotateCcw,
    redo: RotateCw,
    bold: Bold,
    italic: Italic,
    strikethrough: Strikethrough,
    heading: Hash,
    inlineCode: Code,
    indent: IndentIncrease,
    outdent: IndentDecrease,
    quote: Quote,
    link: Link,
    image: Image,
    bulletList: List,
    numberedList: ListOrdered,
    taskList: ListChecks,
    codeBlock: Code2,
    table: Table,
    horizontalRule: Minus,
    date: Calendar,
    aiAssistant: Sparkles,
  };

  const itemLabels: Record<ToolbarItemId, string> = {
    undo: "Undo",
    redo: "Redo",
    bold: "Bold",
    italic: "Italic",
    strikethrough: "Strikethrough",
    heading: "Heading",
    inlineCode: "Inline Code",
    indent: "Indent (Tab)",
    outdent: "Outdent (Shift+Tab)",
    quote: "Quote",
    link: "Link",
    image: "Image",
    bulletList: "Bullet List",
    numberedList: "Numbered List",
    taskList: "Task List",
    codeBlock: "Code Block",
    table: "Table",
    horizontalRule: "Horizontal Rule",
    date: "Insert Date",
    aiAssistant: "AI Assistant",
  };

  const itemDisabled: Record<ToolbarItemId, boolean | undefined> = {
    undo: canUndo === false,
    redo: canRedo === false,
    bold: false,
    italic: false,
    strikethrough: false,
    heading: false,
    inlineCode: false,
    indent: false,
    outdent: false,
    quote: false,
    link: false,
    image: false,
    bulletList: false,
    numberedList: false,
    taskList: false,
    codeBlock: false,
    table: false,
    horizontalRule: false,
    date: false,
    aiAssistant: false,
  };

  const iconSize = 20;
  const iconColor = colors.foreground;

  const ToolbarButton = ({
    onPress,
    ariaLabel,
    IconComponent,
    textIcon,
    disabled,
  }: {
    onPress: () => void;
    ariaLabel: string;
    IconComponent?: React.ComponentType<{ size?: number; color?: string }>;
    textIcon?: string;
    disabled?: boolean;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className={cn(
          "h-10 w-10 items-center justify-center rounded-md active:bg-accent",
          Platform.select({
            web: "hover:bg-accent cursor-pointer",
          })
        )}
        aria-label={ariaLabel}
        accessibilityState={disabled ? { disabled: true } : undefined}
        style={disabled ? { opacity: 0.4 } : undefined}
      >
        {textIcon ? (
          <Text style={{ fontSize: iconSize, color: iconColor, fontWeight: "600" }}>
            {textIcon}
          </Text>
        ) : (
          IconComponent && <IconComponent size={iconSize} color={iconColor} />
        )}
      </Pressable>
    );
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 rounded-full bg-background border border-border w-full"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderRadius: 0,
        borderWidth: 0,
        borderColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
        bounces={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {filteredVisibleItems.map((itemId) => {
          const handler = itemHandlers[itemId];
          const Icon = itemIcons[itemId];
          const label = itemLabels[itemId];
          const disabled = itemDisabled[itemId];

          if (!handler || !Icon) {
            return null;
          }

          return (
            <ToolbarButton
              key={itemId}
              onPress={handler}
              ariaLabel={label}
              IconComponent={Icon}
              disabled={disabled}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
