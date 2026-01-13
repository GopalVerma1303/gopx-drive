import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import { ScrollView, View } from "react-native";
import Markdown from "react-native-markdown-display";

interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
}

export function MarkdownEditor({
  value,
  onChangeText,
  placeholder = "Start writing in markdown...",
  className,
  isPreview = false,
}: MarkdownEditorProps) {
  const { colors } = useThemeColors();

  const markdownStyles = {
    body: {
      color: colors.foreground,
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: colors.foreground,
      fontSize: 32,
      fontWeight: "bold" as const,
      marginTop: 16,
      marginBottom: 8,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 28,
      fontWeight: "bold" as const,
      marginTop: 14,
      marginBottom: 7,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 24,
      fontWeight: "600" as const,
      marginTop: 12,
      marginBottom: 6,
    },
    heading4: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: "600" as const,
      marginTop: 10,
      marginBottom: 5,
    },
    paragraph: {
      color: colors.foreground,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 8,
      marginBottom: 8,
    },
    strong: {
      fontWeight: "bold" as const,
      color: colors.foreground,
    },
    em: {
      fontStyle: "italic" as const,
      color: colors.foreground,
    },
    code_inline: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 14,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: "monospace",
    },
    code_block: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 14,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 8,
      fontFamily: "monospace",
      borderWidth: 0,
    },
    fence: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 14,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 8,
      fontFamily: "monospace",
      borderWidth: 0,
    },
    blockquote: {
      backgroundColor: colors.muted,
      borderLeftWidth: 4,
      borderLeftColor: colors.border,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      marginLeft: 0,
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 4,
      fontStyle: "italic" as const,
      color: colors.mutedForeground,
    },
    list_item: {
      color: colors.foreground,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 4,
      marginBottom: 4,
    },
    link: {
      color: colors.primary,
      textDecorationLine: "underline" as const,
    },
  };

  return (
    <View className={cn("flex-1", className)}>
      {/* Editor or Preview */}
      {isPreview ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {value ? (
            <Markdown style={markdownStyles}>{value}</Markdown>
          ) : (
            <Text className="text-muted-foreground italic">{placeholder}</Text>
          )}
        </ScrollView>
      ) : (
        <Input
          className="flex-1 border-0 shadow-none bg-transparent text-base leading-6 text-foreground font-mono"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
        />
      )}
    </View>
  );
}
