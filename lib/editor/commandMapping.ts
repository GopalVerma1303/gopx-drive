import type { EditorCommandType } from "./types";
import type { ToolbarItemId } from "@/lib/toolbar-preferences";

/**
 * Maps toolbar action IDs to editor command types.
 * Used by both web (MarkdownEditor + toolbar) and native (EditorWebView + toolbar).
 */
const TOOLBAR_TO_COMMAND: Partial<Record<ToolbarItemId, EditorCommandType>> = {
  bold: "ToggleBold",
  italic: "ToggleItalic",
  strikethrough: "ToggleStrikethrough",
  heading: "ToggleHeading",
  inlineCode: "ToggleInlineCode",
  quote: "ToggleBlockQuote",
  link: "InsertLink",
  image: "InsertImage",
  bulletList: "ToggleBulletList",
  numberedList: "ToggleOrderedList",
  taskList: "ToggleTaskList",
  codeBlock: "ToggleCodeBlock",
  table: "InsertTable",
  indent: "Indent",
  outdent: "Outdent",
  undo: "Undo",
  redo: "Redo",
};

/**
 * Resolve a toolbar action ID to an EditorCommandType.
 * Returns null if the action has no corresponding command (e.g. aiAssistant, date, horizontalRule).
 */
export function toolbarActionToCommand(actionId: ToolbarItemId): EditorCommandType | null {
  return TOOLBAR_TO_COMMAND[actionId] ?? null;
}

/**
 * All editor command types that can be sent to the editor (e.g. via WebView postMessage).
 */
export function getAllEditorCommandTypes(): EditorCommandType[] {
  return [
    "ToggleBold",
    "ToggleItalic",
    "ToggleStrikethrough",
    "ToggleHeading",
    "ToggleInlineCode",
    "ToggleBlockQuote",
    "InsertLink",
    "InsertImage",
    "ToggleBulletList",
    "ToggleOrderedList",
    "ToggleTaskList",
    "ToggleCodeBlock",
    "InsertTable",
    "Indent",
    "Outdent",
    "Undo",
    "Redo",
  ];
}
