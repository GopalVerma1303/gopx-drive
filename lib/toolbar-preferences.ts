import AsyncStorage from "@react-native-async-storage/async-storage";

const TOOLBAR_PREFERENCES_KEY = "@toolbar-preferences";

export type ToolbarItemId =
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "strikethrough"
  | "heading1"
  | "heading2"
  | "heading3"
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
  | "aiAssistant"
  | "highlighter"
  | "mention"
  | "toolbarSettings";

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
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "numberedList",
  "taskList",
  "quote",
  "inlineCode",
  "codeBlock",
  "link",
  "image",
  "table",
  "indent",
  "outdent",
  "horizontalRule",
  "highlighter",
  "mention",
  "date",
  "aiAssistant",
  "toolbarSettings",
];

const DEFAULT_HIDDEN: ToolbarItemId[] = [];

export const DEFAULT_PREFERENCES: ToolbarPreferences = {
  visible: DEFAULT_VISIBLE,
  hidden: DEFAULT_HIDDEN,
};

function normalizeToolbarPreferences(raw: any): ToolbarPreferences {
  const rawVisible: string[] = Array.isArray(raw?.visible) ? raw.visible : DEFAULT_VISIBLE;
  const rawHidden: string[] = Array.isArray(raw?.hidden) ? raw.hidden : DEFAULT_HIDDEN;

  // Start from defaults so any new items are available even if older prefs exist
  let visible: ToolbarItemId[] = [...DEFAULT_VISIBLE];
  let hidden: ToolbarItemId[] = [...DEFAULT_HIDDEN];

  // If old "heading" item exists, expand it into heading1/2/3 in-place
  const migratedVisible: string[] = [];
  for (const id of rawVisible) {
    if (id === "heading") {
      migratedVisible.push("heading1", "heading2", "heading3");
    } else {
      migratedVisible.push(id);
    }
  }

  // Only keep known ids and de-duplicate while preserving order
  const seen = new Set<string>();
  const allKnown: Set<string> = new Set(DEFAULT_VISIBLE);
  visible = [];
  for (const id of migratedVisible) {
    if (!allKnown.has(id) || seen.has(id)) continue;
    seen.add(id);
    visible.push(id as ToolbarItemId);
  }

  // Append any new default-visible items that weren't in the stored prefs,
  // so newly added tools (like toolbarSettings) automatically appear.
  for (const id of DEFAULT_VISIBLE) {
    if (!seen.has(id)) {
      visible.push(id);
      seen.add(id);
    }
  }

  // Hidden: drop unknown ids; ensure heading is never kept
  const hiddenSeen = new Set<string>();
  hidden = [];
  for (const id of rawHidden) {
    if (id === "heading") continue;
    if (!allKnown.has(id) || hiddenSeen.has(id)) continue;
    hiddenSeen.add(id);
    // Do not hide headings by default; they can be customized later via UI
    if (id === "heading1" || id === "heading2" || id === "heading3") continue;
    hidden.push(id as ToolbarItemId);
  }

  return { visible, hidden };
}

export async function getToolbarPreferences(): Promise<ToolbarPreferences> {
  try {
    const data = await AsyncStorage.getItem(TOOLBAR_PREFERENCES_KEY);
    if (!data) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(data);
    return normalizeToolbarPreferences(parsed);
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
