export type EditorCommandType =
  | "ToggleBold"
  | "ToggleItalic"
  | "ToggleStrikethrough"
  | "ToggleHeading"
  | "ToggleInlineCode"
  | "ToggleBlockQuote"
  | "InsertLink"
  | "InsertImage"
  | "ToggleBulletList"
  | "ToggleOrderedList"
  | "ToggleTaskList"
  | "ToggleCodeBlock"
  | "InsertTable"
  | "Indent"
  | "Outdent"
  | "Undo"
  | "Redo";

export interface EditorTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  lineHighlight: string;
  /** Base font size in px; should match markdown preview paragraph (default 16). */
  fontSize?: number;
  /** Line height in px; should match markdown preview (default 24). */
  lineHeight?: number;
  /** When true, editor and syntax highlighting use dark-theme–friendly values. */
  isDark?: boolean;
}

export interface EditorInitOptions {
  initialText: string;
  readOnly?: boolean;
  onChange?: (text: string) => void;
  onSelectionChange?: (from: number, to: number) => void;
  theme?: Partial<EditorTheme>;
}

export interface EditorHandle {
  /** Execute a high-level editor command (bold, list, etc.). */
  execCommand: (command: EditorCommandType, args?: any) => void;
  /** Get current full document text. */
  getValue: () => string;
  /** Replace full document text. */
  setValue: (text: string) => void;
  /** Focus the editor view. */
  focus: () => void;
  /** Get current selection range in document offsets. */
  getSelection: () => { from: number; to: number };
  /** Set current selection range in document offsets. */
  setSelection: (from: number, to: number) => void;
  /** Replace text in a given range and place the cursor at the end of the inserted text. */
  replaceRange: (from: number, to: number, text: string) => void;
  /** Optional cleanup hook to destroy underlying resources, if any. */
  destroy?: () => void;
}

