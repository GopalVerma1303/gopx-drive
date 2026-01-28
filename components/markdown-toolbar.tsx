import { useThemeColors } from "@/lib/use-theme-colors";
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
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

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
}: MarkdownToolbarProps) {
  const { colors } = useThemeColors();
  const TAB_SPACES = "   ";

  if (isPreview) {
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
    // Insert ![]() with cursor positioned between brackets for alt text
    onInsertText("![]()", 2);
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
        {/* Undo / Redo */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          <ToolbarButton
            onPress={handleUndo}
            ariaLabel="Undo"
            IconComponent={RotateCcw}
            disabled={canUndo === false}
          />
          <ToolbarButton
            onPress={handleRedo}
            ariaLabel="Redo"
            IconComponent={RotateCw}
            disabled={canRedo === false}
          />
        </View>

        {/* Divider */}
        <View
          style={{
            width: 1,
            height: 32,
            backgroundColor: colors.border,
            marginHorizontal: 4,
          }}
        />

        {/* Essential Formatting Icons */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          <ToolbarButton onPress={handleBold} ariaLabel="Bold" IconComponent={Bold} />
          <ToolbarButton onPress={handleItalic} ariaLabel="Italic" IconComponent={Italic} />
          <ToolbarButton onPress={handleStrikethrough} ariaLabel="Strikethrough" IconComponent={Strikethrough} />
          <ToolbarButton onPress={handleHeading} ariaLabel="Heading" IconComponent={Hash} />
          <ToolbarButton onPress={handleInlineCode} ariaLabel="Inline Code" IconComponent={Code} />
          <ToolbarButton onPress={handleIndent} ariaLabel="Indent (Tab)" IconComponent={IndentIncrease} />
          <ToolbarButton onPress={handleOutdent} ariaLabel="Outdent (Shift+Tab)" IconComponent={IndentDecrease} />
          <ToolbarButton onPress={handleQuote} ariaLabel="Quote" IconComponent={Quote} />
          <ToolbarButton onPress={handleLink} ariaLabel="Link" IconComponent={Link} />
          <ToolbarButton onPress={handleImage} ariaLabel="Image" IconComponent={Image} />
        </View>

        {/* Divider */}
        <View
          style={{
            width: 1,
            height: 32,
            backgroundColor: colors.border,
            marginHorizontal: 4,
          }}
        />

        {/* List and Structure Icons */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          <ToolbarButton onPress={handleBulletList} ariaLabel="Bullet List" IconComponent={List} />
          <ToolbarButton onPress={handleNumberedList} ariaLabel="Numbered List" IconComponent={ListOrdered} />
          <ToolbarButton onPress={handleTaskList} ariaLabel="Task List" IconComponent={ListChecks} />
        </View>

        {/* Divider */}
        <View
          style={{
            width: 1,
            height: 32,
            backgroundColor: colors.border,
            marginHorizontal: 4,
          }}
        />

        {/* Advanced Actions */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          <ToolbarButton onPress={handleCodeBlock} ariaLabel="Code Block" IconComponent={Code2} />
          <ToolbarButton onPress={handleTable} ariaLabel="Table" IconComponent={Table} />
          <ToolbarButton onPress={handleHorizontalRule} ariaLabel="Horizontal Rule" IconComponent={Minus} />
          <ToolbarButton onPress={handleDate} ariaLabel="Insert Date" IconComponent={Calendar} />
          {onAIAssistant && (
            <ToolbarButton onPress={handleAIAssistant} ariaLabel="AI Assistant" IconComponent={Sparkles} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
