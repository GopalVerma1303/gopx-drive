import AsyncStorage from "@react-native-async-storage/async-storage";

const TOOLBAR_PREFERENCES_KEY = "@toolbar-preferences";

export type ToolbarItemId =
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "strikethrough"
  | "heading"
  | "inlineCode"
  | "indent"
  | "outdent"
  | "quote"
  | "link"
  | "image"
  | "bulletList"
  | "numberedList"
  | "taskList"
  | "codeBlock"
  | "table"
  | "horizontalRule"
  | "date"
  | "aiAssistant";

export interface ToolbarPreferences {
  visible: ToolbarItemId[];
  hidden: ToolbarItemId[];
}

const DEFAULT_VISIBLE: ToolbarItemId[] = [
  "undo",
  "redo",
  "bold",
  "italic",
  "strikethrough",
  "heading",
  "inlineCode",
  "indent",
  "outdent",
  "quote",
  "link",
  "image",
  "bulletList",
  "numberedList",
  "taskList",
  "codeBlock",
  "table",
  "horizontalRule",
  "date",
  "aiAssistant",
];

const DEFAULT_HIDDEN: ToolbarItemId[] = [];

export const DEFAULT_PREFERENCES: ToolbarPreferences = {
  visible: DEFAULT_VISIBLE,
  hidden: DEFAULT_HIDDEN,
};

export async function getToolbarPreferences(): Promise<ToolbarPreferences> {
  try {
    const data = await AsyncStorage.getItem(TOOLBAR_PREFERENCES_KEY);
    if (!data) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(data);
    return {
      visible: parsed.visible || DEFAULT_VISIBLE,
      hidden: parsed.hidden || DEFAULT_HIDDEN,
    };
  } catch (error) {
    console.error("Error loading toolbar preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

export async function saveToolbarPreferences(
  preferences: ToolbarPreferences
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TOOLBAR_PREFERENCES_KEY,
      JSON.stringify(preferences)
    );
  } catch (error) {
    console.error("Error saving toolbar preferences:", error);
    throw error;
  }
}
