export interface EditorControl {
  insertText(text: string, cursorOffset?: number): void;
  wrapSelection(before: string, after: string, cursorOffset?: number): void;
  indent(): void;
  outdent(): void;
  undo(): void;
  redo(): void;
  focus(): void;
  getSelection(): Promise<{ start: number; end: number }>;
  updateBody(newBody: string): void;
  setScrollPercent(fraction: number): void;
  select(anchor: number, head: number): void;
}

export interface EditorSettings {
  theme: 'light' | 'dark';
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  spellcheck: boolean;
  backgroundColor?: string;
}

export interface EditorEvent {
  kind: 'change' | 'selectionChange' | 'scroll' | 'blur' | 'focus';
  value?: string;
  selection?: { start: number; end: number };
  scrollFraction?: number;
}
