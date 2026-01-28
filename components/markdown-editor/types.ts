export interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
  onSave?: () => void;
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
}

export type Snapshot = { text: string; selection: { start: number; end: number } };

export type MarkerType = 'numeric' | 'lowercase-alpha' | 'uppercase-alpha' | 'lowercase-roman' | 'uppercase-roman';

export type ListMarkerType = 'ordered' | 'unordered' | 'checkbox' | null;

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
