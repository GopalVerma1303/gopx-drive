import { EditorView } from "@codemirror/view";
import { EditorTheme } from "./types";

const defaultTheme: EditorTheme = {
  background: "#ffffff",
  foreground: "#000000",
  cursor: "#000000",
  selection: "#cce4ff",
  lineHighlight: "#f5f5f5",
  fontSize: 16,
  lineHeight: 24,
};

/**
 * Build a CodeMirror theme extension from app-level colors.
 * Uses fontSize/lineHeight to match markdown preview; isDark for dark-mode styling.
 */
export const createEditorThemeExtension = (themeOverride?: Partial<EditorTheme>) => {
  const theme: EditorTheme = { ...defaultTheme, ...themeOverride };
  const fontSize = theme.fontSize ?? 16;
  const lineHeight = theme.lineHeight ?? 24;
  const isDark = theme.isDark ?? false;

  return EditorView.theme(
    {
      "&": {
        color: theme.foreground,
        backgroundColor: theme.background,
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-content": {
        caretColor: theme.cursor,
        outline: "none",
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}px`,
      },
      "&.cm-focused .cm-cursor": {
        borderLeftColor: theme.cursor,
      },
      "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: theme.selection,
      },
      ".cm-activeLine": {
        backgroundColor: theme.lineHighlight,
      },
    },
    { dark: isDark }
  );
};

