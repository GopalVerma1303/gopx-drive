export interface MarkdownEditorProps {
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
  onSave?: () => void;
  /** Called whenever selection changes so parent can preserve it (e.g. before opening a modal that steals focus). */
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  /** When true, only the preview is rendered (no editor). Use for shared note view. Requires isPreview. */
  previewOnly?: boolean;
  /** When true with previewOnly, render only the Markdown content without ScrollView (parent provides scroll). */
  noScrollView?: boolean;
}

export interface MarkdownEditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  indent: () => void;
  outdent: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  focus: () => void;
  getSelection: () => { start: number; end: number };
  /** Replace the range [start, end) with text and place cursor after it. Use when selection was lost (e.g. after opening a modal). */
  replaceRange: (start: number, end: number, text: string) => void;
}

export type Snapshot = {
  text: string;
  selection: { start: number; end: number };
};

export type MarkerType =
  | "numeric"
  | "lowercase-alpha"
  | "uppercase-alpha"
  | "lowercase-roman"
  | "uppercase-roman";

export type ListMarkerType = "ordered" | "unordered" | "checkbox" | null;

export interface ListInfo {
  isList: boolean;
  indent: string;
  marker: string;
  markerType: ListMarkerType;
  markerSubtype?: MarkerType;
  nextMarker: string;
  currentLine: string;
  lineIndex: number;
}
