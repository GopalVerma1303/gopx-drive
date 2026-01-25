import { detectCheckboxInLine, toggleCheckboxInMarkdown } from "@/components/markdown-toolbar";
import { SyntaxHighlighter } from "@/components/syntax-highlighter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { MARKDOWN_EDITOR_SYNTAX_COLORS, type MarkdownEditorSyntaxPalette, type MarkdownEditorSyntaxToken } from "@/lib/markdown-editor-syntax";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, Text as RNText, ScrollView, TextInput, View } from "react-native";
import Markdown, { renderRules } from "react-native-markdown-display";

type SyntaxSegment = {
  text: string;
  token: MarkdownEditorSyntaxToken;
  bgToken?: MarkdownEditorSyntaxToken;
  style?: any;
};

const MARKDOWN_IMAGE_SIZE_CACHE = new Map<string, { width: number; height: number }>();

function MarkdownPreviewImage({
  uri,
  alt,
  maxWidth,
  colors,
}: {
  uri: string;
  alt?: string;
  maxWidth: number;
  colors: { muted: string; ring: string };
}) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(() => {
    const cached = MARKDOWN_IMAGE_SIZE_CACHE.get(uri);
    if (!cached) return null;
    const r = cached.width / cached.height;
    return Number.isFinite(r) && r > 0 ? r : null;
  });

  useEffect(() => {
    if (!uri) return;

    const cached = MARKDOWN_IMAGE_SIZE_CACHE.get(uri);
    if (cached) {
      const r = cached.width / cached.height;
      setAspectRatio(Number.isFinite(r) && r > 0 ? r : null);
      return;
    }

    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled) return;
        if (!w || !h) return;
        MARKDOWN_IMAGE_SIZE_CACHE.set(uri, { width: w, height: h });
        const r = w / h;
        setAspectRatio(Number.isFinite(r) && r > 0 ? r : null);
      },
      () => {
        if (cancelled) return;
        setAspectRatio(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [uri]);

  const width = Math.max(1, maxWidth || 0);
  const height = aspectRatio ? width / aspectRatio : Math.max(180, Math.min(320, Math.round(width * 0.6)));

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt}
      resizeMode="contain"
      style={{
        width,
        height,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.ring,
      }}
    />
  );
}

const INLINE_MARKDOWN_RE =
  /(`[^`]*`)|(!?\[[^\]]*\]\([^)]+\))|(~~[^~]+~~)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)/g;

const isHorizontalRule = (line: string) => /^\s*(?:---|\*\*\*|___)\s*$/.test(line);
const fenceStartOrEnd = (line: string) => /^\s*```/.test(line) || /^\s*~~~/.test(line);

const mkSeg = (text: string, token: MarkdownEditorSyntaxToken, bgToken?: MarkdownEditorSyntaxToken): SyntaxSegment => ({
  text,
  token,
  ...(bgToken ? { bgToken } : {}),
});

const mkSegStyled = (
  text: string,
  token: MarkdownEditorSyntaxToken,
  style?: any,
  bgToken?: MarkdownEditorSyntaxToken
): SyntaxSegment => ({
  text,
  token,
  ...(bgToken ? { bgToken } : {}),
  ...(style ? { style } : {}),
});

function highlightInlineMarkdown(text: string): SyntaxSegment[] {
  const segments: SyntaxSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_MARKDOWN_RE)) {
    const m = match[0] ?? "";
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(mkSeg(text.slice(lastIndex, index), "text"));
    }

    // Inline code: `code`
    if (m.startsWith("`")) {
      const inner = m.slice(1, -1);
      const codeStyle = { fontFamily: "monospace" };
      segments.push(mkSegStyled("`", "inlineCode.marker", codeStyle, "inlineCode.bg"));
      if (inner.length > 0) segments.push(mkSegStyled(inner, "inlineCode.text", codeStyle, "inlineCode.bg"));
      segments.push(mkSegStyled("`", "inlineCode.marker", codeStyle, "inlineCode.bg"));
      lastIndex = index + m.length;
      continue;
    }

    // Links / images: [text](url) or ![alt](url)
    if (m.startsWith("[") || m.startsWith("![")) {
      const isImage = m.startsWith("![");
      const mm = m.match(/^!?\[([^\]]*)\]\(([^)]+)\)$/);
      if (mm) {
        const label = mm[1] ?? "";
        const url = mm[2] ?? "";
        segments.push(mkSeg(isImage ? "![" : "[", isImage ? "image.brackets" : "link.brackets"));
        if (label) segments.push(mkSeg(label, isImage ? "image.alt" : "link.text"));
        segments.push(mkSeg("](", isImage ? "image.brackets" : "link.brackets"));
        if (url) segments.push(mkSeg(url, isImage ? "image.url" : "link.url"));
        segments.push(mkSeg(")", isImage ? "image.brackets" : "link.brackets"));
      } else {
        segments.push(mkSeg(m, "punctuation"));
      }
      lastIndex = index + m.length;
      continue;
    }

    // Emphasis / strike (we mostly color the markers so the *content* stays readable)
    const wrap = (
      marker: string,
      markerToken: MarkdownEditorSyntaxToken,
      content: string,
      contentStyle?: any,
      markerStyle?: any
    ) => {
      segments.push(mkSegStyled(marker, markerToken, markerStyle));
      if (content) segments.push(mkSegStyled(content, "emphasis.text", contentStyle));
      segments.push(mkSegStyled(marker, markerToken, markerStyle));
    };

    if (m.startsWith("~~") && m.endsWith("~~")) {
      const strike = { textDecorationLine: "line-through" as const };
      // Only strike the content, not the marker tildes (keeps cursor metrics stable).
      wrap("~~", "emphasis.marker", m.slice(2, -2), strike, undefined);
      lastIndex = index + m.length;
      continue;
    }
    if (m.startsWith("**") && m.endsWith("**")) {
      const bold = { fontWeight: "700" as const };
      // Only bold the content, not the marker asterisks.
      segments.push(mkSegStyled("**", "emphasis.marker"));
      if (m.length > 4) segments.push(mkSegStyled(m.slice(2, -2), "emphasis.text", bold));
      segments.push(mkSegStyled("**", "emphasis.marker"));
      lastIndex = index + m.length;
      continue;
    }
    if (m.startsWith("__") && m.endsWith("__")) {
      const bold = { fontWeight: "700" as const };
      // Only bold the content, not the marker underscores.
      segments.push(mkSegStyled("__", "emphasis.marker"));
      if (m.length > 4) segments.push(mkSegStyled(m.slice(2, -2), "emphasis.text", bold));
      segments.push(mkSegStyled("__", "emphasis.marker"));
      lastIndex = index + m.length;
      continue;
    }
    if (m.startsWith("*") && m.endsWith("*") && m.length >= 2) {
      const italic = { fontStyle: "italic" as const };
      // Only italicize the content, not the marker asterisks.
      wrap("*", "emphasis.marker", m.slice(1, -1), italic, undefined);
      lastIndex = index + m.length;
      continue;
    }
    if (m.startsWith("_") && m.endsWith("_") && m.length >= 2) {
      const italic = { fontStyle: "italic" as const };
      // Only italicize the content, not the marker underscores.
      wrap("_", "emphasis.marker", m.slice(1, -1), italic, undefined);
      lastIndex = index + m.length;
      continue;
    }

    // Fallback
    segments.push(mkSeg(m, "punctuation"));
    lastIndex = index + m.length;
  }

  if (lastIndex < text.length) {
    segments.push(mkSeg(text.slice(lastIndex), "text"));
  }

  return segments;
}

const JS_KEYWORDS_RE =
  /\b(?:import|from|export|default|const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|implements|interface|type|public|private|protected|async|await|yield|this|super|in|of|instanceof)\b/g;
const BUILTINS_RE = /\b(?:true|false|null|undefined|NaN|Infinity)\b/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g;
const STRING_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;

function highlightPlainCodeChunk(chunk: string): SyntaxSegment[] {
  const segments: SyntaxSegment[] = [];
  const matches: Array<{ start: number; end: number; token: MarkdownEditorSyntaxToken }> = [];

  for (const m of chunk.matchAll(JS_KEYWORDS_RE)) {
    const idx = m.index ?? 0;
    const raw = m[0] ?? "";
    matches.push({ start: idx, end: idx + raw.length, token: "code.keyword" });
  }
  for (const m of chunk.matchAll(BUILTINS_RE)) {
    const idx = m.index ?? 0;
    const raw = m[0] ?? "";
    matches.push({ start: idx, end: idx + raw.length, token: "code.builtin" });
  }
  for (const m of chunk.matchAll(NUMBER_RE)) {
    const idx = m.index ?? 0;
    const raw = m[0] ?? "";
    matches.push({ start: idx, end: idx + raw.length, token: "code.number" });
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  let cursor = 0;
  for (const mt of matches) {
    if (mt.start < cursor) continue; // overlap
    if (mt.start > cursor) segments.push(mkSeg(chunk.slice(cursor, mt.start), "code.text"));
    segments.push(mkSeg(chunk.slice(mt.start, mt.end), mt.token));
    cursor = mt.end;
  }
  if (cursor < chunk.length) segments.push(mkSeg(chunk.slice(cursor), "code.text"));

  return segments.length ? segments : [mkSeg(chunk, "code.text")];
}

function highlightCodeLikeLine(line: string): SyntaxSegment[] {
  // Very lightweight regex-highlighting (fast + “good enough” while editing).
  // We intentionally avoid deep parsing to keep typing responsive.
  const segments: SyntaxSegment[] = [];

  // Split trailing // comment (naive but effective)
  const commentIdx = line.indexOf("//");
  const beforeComment = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const comment = commentIdx >= 0 ? line.slice(commentIdx) : "";

  // First split strings so keywords/numbers don't color inside them
  let last = 0;
  for (const m of beforeComment.matchAll(STRING_RE)) {
    const idx = m.index ?? 0;
    const raw = m[0] ?? "";
    if (idx > last) {
      const chunk = beforeComment.slice(last, idx);
      segments.push(...highlightPlainCodeChunk(chunk));
    }
    segments.push(mkSeg(raw, "code.string"));
    last = idx + raw.length;
  }

  if (last === 0 && beforeComment.length > 0) {
    segments.push(...highlightPlainCodeChunk(beforeComment));
  } else if (last < beforeComment.length) {
    segments.push(...highlightPlainCodeChunk(beforeComment.slice(last)));
  }

  if (comment) segments.push(mkSeg(comment, "code.comment"));
  if (segments.length === 0) segments.push(mkSeg(line, "code.text"));

  return segments;
}

function renderSyntaxSegments(segments: SyntaxSegment[], palette: MarkdownEditorSyntaxPalette, keyPrefix: string) {
  return segments.map((seg, i) => {
    const color = palette[seg.token];
    const backgroundColor = seg.bgToken ? palette[seg.bgToken] : undefined;
    return (
      <RNText
        key={`${keyPrefix}-${i}`}
        style={{
          color,
          ...(backgroundColor ? { backgroundColor } : null),
          ...(seg.style ? seg.style : null),
        }}
      >
        {seg.text}
      </RNText>
    );
  });
}

function overrideTokens(
  segments: SyntaxSegment[],
  overrideToken: MarkdownEditorSyntaxToken,
  tokensToOverride: Set<MarkdownEditorSyntaxToken>
): SyntaxSegment[] {
  return segments.map((s) => (tokensToOverride.has(s.token) ? { ...s, token: overrideToken } : s));
}

function renderHighlightedMarkdownDocument(value: string, palette: MarkdownEditorSyntaxPalette) {
  // Safety guard: avoid turning very large notes into thousands of <Text> nodes.
  const lineCount = (value.match(/\n/g)?.length ?? 0) + 1;
  if (value.length > 50_000 || lineCount > 2_000) {
    return <RNText style={{ color: palette.text }}>{value}</RNText>;
  }

  const lines = value.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];

  let inFence = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";

    // Fenced code blocks
    if (fenceStartOrEnd(line)) {
      // IMPORTANT: preserve the *exact* characters/spaces after the fence marker.
      // Rendering a reconstructed string (e.g. inserting a space before language)
      // causes caret/visual mismatches while typing.
      const m = line.match(/^(\s*)(```|~~~)(.*)$/);
      const indent = m?.[1] ?? "";
      const marker = m?.[2] ?? "```";
      const rest = m?.[3] ?? "";

      out.push(
        ...renderSyntaxSegments(
          [mkSeg(indent, "fence.marker"), mkSeg(marker, "fence.marker"), mkSeg(rest, "fence.language")],
          palette,
          `fence-${lineIndex}`
        )
      );
      if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);

      if (!inFence) {
        inFence = true;
      } else {
        inFence = false;
      }
      continue;
    }

    if (inFence) {
      // Treat fence body as "code-ish" for readability.
      out.push(...renderSyntaxSegments(highlightCodeLikeLine(line), palette, `code-${lineIndex}`));
      if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);
      continue;
    }

    // Horizontal rules (---, ***)
    if (isHorizontalRule(line)) {
      out.push(...renderSyntaxSegments([mkSeg(line, "hr")], palette, `hr-${lineIndex}`));
      if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);
      continue;
    }

    // Headings: ### Title
    const headingMatch = line.match(/^(#{1,6})(\s+)(.*)$/);
    if (headingMatch) {
      const [, hashes, space, rest] = headingMatch;
      const inline = highlightInlineMarkdown(rest);
      const headingOverrides = new Set<MarkdownEditorSyntaxToken>([
        "text",
        "punctuation",
        "emphasis.marker",
        "emphasis.text",
      ]);
      const colored = overrideTokens(inline, "heading.text", headingOverrides);
      out.push(
        ...renderSyntaxSegments(
          [mkSeg(hashes, "heading.marker"), mkSeg(space, "heading.text"), ...colored],
          palette,
          `h-${lineIndex}`
        )
      );
      if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);
      continue;
    }

    // Blockquotes: > text
    const bqMatch = line.match(/^(\s*>)(\s?)(.*)$/);
    if (bqMatch) {
      const [, marker, space, rest] = bqMatch;
      const inline = highlightInlineMarkdown(rest);
      const bqOverrides = new Set<MarkdownEditorSyntaxToken>([
        "text",
        "punctuation",
        "emphasis.marker",
        "emphasis.text",
      ]);
      const colored = overrideTokens(inline, "blockquote.marker", bqOverrides);
      const segs: SyntaxSegment[] = [mkSeg(marker, "blockquote.marker"), mkSeg(space, "blockquote.marker"), ...colored];
      out.push(...renderSyntaxSegments(segs, palette, `bq-${lineIndex}`));
      if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);
      continue;
    }

    // Lists: - item / 1. item
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)(\s+)(.*)$/);
    if (listMatch) {
      const [, indent, marker, space, rest] = listMatch;
      const inline = highlightInlineMarkdown(rest);
      const listOverrides = new Set<MarkdownEditorSyntaxToken>([
        "text",
        "punctuation",
        "emphasis.marker",
        "emphasis.text",
      ]);
      const colored = overrideTokens(inline, "list.marker", listOverrides);
      const segs: SyntaxSegment[] = [
        mkSeg(indent, "list.marker"),
        mkSeg(marker, "list.marker"),
        mkSeg(space, "list.marker"),
        ...colored,
      ];
      out.push(...renderSyntaxSegments(segs, palette, `li-${lineIndex}`));
      if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);
      continue;
    }

    // Default: highlight inline patterns
    out.push(...renderSyntaxSegments(highlightInlineMarkdown(line), palette, `ln-${lineIndex}`));
    if (lineIndex < lines.length - 1) out.push(<RNText key={`nl-${lineIndex}`}>{"\n"}</RNText>);
  }

  return out;
}

interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
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

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChangeText,
      placeholder = "Start writing in markdown...",
      className,
      isPreview = false,
    },
    ref
  ) {
    const { colors, isDark } = useThemeColors();
    const inputRef = useRef<TextInput>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [previewContentWidth, setPreviewContentWidth] = useState<number>(0);
    const selectionRef = useRef(selection);
    const previousValueRef = useRef<string>(value);
    const isProcessingListRef = useRef<boolean>(false);
    const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const suppressSelectionUpdatesRef = useRef<number>(0);
    const TAB_SPACES = "   ";

    type Snapshot = { text: string; selection: { start: number; end: number } };
    const MAX_HISTORY = 200;
    const undoStackRef = useRef<Snapshot[]>([]);
    const redoStackRef = useRef<Snapshot[]>([]);
    const pendingInternalValueRef = useRef<string | null>(null);

    const setSelectionBoth = (nextSelection: { start: number; end: number }) => {
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
    };

    const beginProgrammaticSelection = (nextSelection: { start: number; end: number }) => {
      pendingSelectionRef.current = nextSelection;
      suppressSelectionUpdatesRef.current += 1;
      setSelectionBoth(nextSelection);
    };

    const endProgrammaticSelection = () => {
      suppressSelectionUpdatesRef.current = Math.max(0, suppressSelectionUpdatesRef.current - 1);
      if (suppressSelectionUpdatesRef.current === 0) {
        pendingSelectionRef.current = null;
      }
    };

    const pushUndoSnapshot = (snapshot: Snapshot) => {
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > MAX_HISTORY) {
        undoStackRef.current.shift();
      }
    };

    const pushRedoSnapshot = (snapshot: Snapshot) => {
      redoStackRef.current.push(snapshot);
      if (redoStackRef.current.length > MAX_HISTORY) {
        redoStackRef.current.shift();
      }
    };

    // Helper function to detect list patterns and get next list marker
    const getListInfo = (text: string, cursorPosition: number): {
      isList: boolean;
      indent: string;
      marker: string;
      markerType: 'ordered' | 'unordered' | 'checkbox' | null;
      nextMarker: string;
      currentLine: string;
      lineIndex: number;
    } | null => {
      const lines = text.split('\n');
      const beforeCursor = text.substring(0, cursorPosition);
      const lineIndex = beforeCursor.split('\n').length - 1;
      const currentLine = lines[lineIndex] || '';

      // Match checkbox list FIRST (before unordered) since they share the same prefix: "- [ ] ", "* [ ] ", "+ [ ] " (with optional indentation)
      const checkboxMatch = currentLine.match(/^(\s*)([-*+])\s+\[([\s*xX*])\]\s*(.*)$/);
      if (checkboxMatch) {
        const [, indent, marker, checkboxState, content] = checkboxMatch;
        return {
          isList: true,
          indent,
          marker: `${marker} [${checkboxState}] `,
          markerType: 'checkbox',
          nextMarker: `${marker} [ ] `,
          currentLine,
          lineIndex,
        };
      }

      // Match ordered list: "1. ", "2. ", etc. (with optional indentation)
      const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        const [, indent, number, content] = orderedMatch;
        const nextNumber = parseInt(number, 10) + 1;
        return {
          isList: true,
          indent,
          marker: `${number}. `,
          markerType: 'ordered',
          nextMarker: `${nextNumber}. `,
          currentLine,
          lineIndex,
        };
      }

      // Match unordered list: "- ", "* ", "+ " (with optional indentation)
      // This must come AFTER checkbox check to avoid false matches
      const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
      if (unorderedMatch) {
        const [, indent, marker, content] = unorderedMatch;
        return {
          isList: true,
          indent,
          marker: `${marker} `,
          markerType: 'unordered',
          nextMarker: `${marker} `,
          currentLine,
          lineIndex,
        };
      }

      return null;
    };

    // Handle text changes to detect and process list continuations
    const handleTextChange = (newText: string) => {
      // Skip processing if we're already processing a list change (avoid infinite loops)
      if (isProcessingListRef.current) {
        previousValueRef.current = newText;
        pendingInternalValueRef.current = newText;
        onChangeText(newText);
        return;
      }

      const oldText = previousValueRef.current;
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');

      // Record undo snapshot (user typing) before any auto-transforms.
      if (!isPreview && oldText !== newText) {
        pushUndoSnapshot({ text: oldText, selection: selectionRef.current });
        redoStackRef.current = [];
      }

      // Check if a newline was just added (text increased by exactly one line)
      if (newLines.length === oldLines.length + 1) {
        // Determine the exact insertion point for the newline using a prefix/suffix diff.
        // This is more reliable than line-by-line comparison when inserting in the middle
        // of a document (e.g., adding a new list item between existing items).
        let prefixLen = 0;
        const maxPrefix = Math.min(oldText.length, newText.length);
        while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
          prefixLen++;
        }

        let oldSuffixIdx = oldText.length - 1;
        let newSuffixIdx = newText.length - 1;
        while (
          oldSuffixIdx >= prefixLen &&
          newSuffixIdx >= prefixLen &&
          oldText[oldSuffixIdx] === newText[newSuffixIdx]
        ) {
          oldSuffixIdx--;
          newSuffixIdx--;
        }

        const inserted = newText.slice(prefixLen, newSuffixIdx + 1);
        const removed = oldText.slice(prefixLen, oldSuffixIdx + 1);
        const normalizedInserted = inserted.replace(/\r/g, "");

        // Only auto-continue lists for a plain "Enter" that inserts exactly one newline.
        if (!(removed.length === 0 && normalizedInserted === "\n")) {
          previousValueRef.current = newText;
          pendingInternalValueRef.current = newText;
          onChangeText(newText);
          return;
        }

        // Figure out where the newline was inserted in the OLD text.
        // Prefix/suffix diffs can be ambiguous when inserting "\n" next to an existing "\n"
        // (e.g., adding a blank line between existing lines). Prefer the current selection
        // (often still at the pre-change cursor) and fall back to diff-derived candidates.
        const insertedRawLen = inserted.length;
        const isValidInsertionAt = (pos: number) => {
          if (pos < 0 || pos > oldText.length) return false;
          if (newText.slice(0, pos) !== oldText.slice(0, pos)) return false;
          if (newText.slice(pos, pos + insertedRawLen).replace(/\r/g, "") !== "\n") return false;
          return newText.slice(pos + insertedRawLen) === oldText.slice(pos);
        };

        const selStart = selectionRef.current.start;
        const cursorCandidates = [
          selStart,
          selStart - insertedRawLen,
          prefixLen,
          prefixLen - insertedRawLen,
          prefixLen - 1,
        ].filter((n) => Number.isFinite(n));

        const resolvedCursorBeforeSplit =
          cursorCandidates.find((pos) => isValidInsertionAt(pos)) ?? prefixLen;

        const cursorBeforeSplit = Math.max(0, Math.min(oldText.length, resolvedCursorBeforeSplit));

        // Check if we're in a list context at the cursor position before split
        const listInfo = getListInfo(oldText, cursorBeforeSplit);

        if (listInfo) {
          const { indent, marker, markerType, nextMarker, currentLine, lineIndex: splitLineIndex } = listInfo;

          const newLineAfterSplit = newLines[splitLineIndex + 1] || '';

          // Avoid inserting list markers if the cursor is before (or inside) the list marker itself.
          // Example: cursor at the start of "- [ ] item" shouldn't cause "- [ ] - [ ] item".
          const lineStart = oldText.lastIndexOf('\n', Math.max(0, cursorBeforeSplit - 1)) + 1;
          const cursorColumn = cursorBeforeSplit - lineStart;
          const markerEndColumn = indent.length + marker.length;
          if (cursorColumn < markerEndColumn) {
            previousValueRef.current = newText;
            pendingInternalValueRef.current = newText;
            onChangeText(newText);
            return;
          }

          // Check if the old line (before split) was empty (only marker, no content)
          const oldLineContent = currentLine.replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '') // Remove checkbox
            .replace(/^\s*\d+\.\s+/, '') // Remove ordered marker
            .replace(/^\s*[-*+]\s+/, '') // Remove unordered marker
            .trim();

          if (oldLineContent === '' && newLineAfterSplit.trim() === '') {
            // Empty list item - remove it and keep just the newline
            isProcessingListRef.current = true;
            const updatedLines = [...newLines];
            updatedLines.splice(splitLineIndex, 1);
            const updatedText = updatedLines.join('\n');

            // Calculate new cursor position (at the start of what was the next line)
            let newCursorPosition = 0;
            for (let i = 0; i < splitLineIndex; i++) {
              newCursorPosition += (updatedLines[i]?.length || 0) + 1;
            }

            // Establish the cursor position early so RN doesn't briefly reset it (e.g., to 0)
            beginProgrammaticSelection({
              start: newCursorPosition,
              end: newCursorPosition,
            });

            previousValueRef.current = updatedText;
            pendingInternalValueRef.current = updatedText;
            onChangeText(updatedText);

            requestAnimationFrame(() => {
              setTimeout(() => {
                if (Platform.OS === "web") {
                  const input = inputRef.current as any;
                  if (input && input.setSelectionRange) {
                    input.setSelectionRange(newCursorPosition, newCursorPosition);
                  }
                } else {
                  const input = inputRef.current as any;
                  if (input && typeof input.setNativeProps === "function") {
                    input.setNativeProps({
                      selection: { start: newCursorPosition, end: newCursorPosition },
                    });
                  }
                }
                inputRef.current?.focus();
                isProcessingListRef.current = false;
                endProgrammaticSelection();
              }, Platform.OS === "android" ? 16 : 0);
            });
            return;
          } else if (oldLineContent !== '') {
            // Non-empty list item - add next marker to the new line
            isProcessingListRef.current = true;
            const updatedLines = [...newLines];
            // Remove any existing content from the new line and add the marker
            updatedLines[splitLineIndex + 1] = indent + nextMarker + newLineAfterSplit;

            // If we're inserting into an ordered list, renumber subsequent siblings (+1) until the list ends.
            // Stop at the first blank line; also stop when we encounter a line that isn't part of this list level.
            if (markerType === 'ordered') {
              const insertedNumber = parseInt(nextMarker, 10);
              if (Number.isFinite(insertedNumber)) {
                let nextNumber = insertedNumber + 1;

                for (let i = splitLineIndex + 2; i < updatedLines.length; i++) {
                  const line = updatedLines[i] ?? '';

                  // A blank line terminates the list.
                  if (line.trim() === '') break;

                  const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

                  if (!orderedMatch) {
                    // Allow nested content (more-indented) to exist inside a list item without ending the list.
                    const lineIndent = (line.match(/^(\s*)/)?.[1]) ?? '';
                    if (lineIndent.length > indent.length) {
                      continue;
                    }
                    break;
                  }

                  const lineIndent = orderedMatch[1] ?? '';
                  const lineContent = orderedMatch[3] ?? '';

                  if (lineIndent === indent) {
                    updatedLines[i] = `${indent}${nextNumber}. ${lineContent}`;
                    nextNumber += 1;
                    continue;
                  }

                  // Nested ordered list (more-indented) - don't renumber at this level, but don't end the list either.
                  if (lineIndent.length > indent.length) {
                    continue;
                  }

                  // Less indentation indicates we've left this list level.
                  break;
                }
              }
            }

            const updatedText = updatedLines.join('\n');

            // Calculate new cursor position (after the marker on the new line)
            let newCursorPosition = 0;
            for (let i = 0; i <= splitLineIndex; i++) {
              newCursorPosition += (updatedLines[i]?.length || 0) + 1;
            }
            newCursorPosition += indent.length + nextMarker.length;

            // Establish the cursor position early so RN doesn't briefly reset it (e.g., to 0)
            beginProgrammaticSelection({
              start: newCursorPosition,
              end: newCursorPosition,
            });

            previousValueRef.current = updatedText;
            pendingInternalValueRef.current = updatedText;
            onChangeText(updatedText);

            requestAnimationFrame(() => {
              setTimeout(() => {
                if (Platform.OS === "web") {
                  const input = inputRef.current as any;
                  if (input && input.setSelectionRange) {
                    input.setSelectionRange(newCursorPosition, newCursorPosition);
                  }
                } else {
                  const input = inputRef.current as any;
                  if (input && typeof input.setNativeProps === "function") {
                    input.setNativeProps({
                      selection: { start: newCursorPosition, end: newCursorPosition },
                    });
                  }
                }
                inputRef.current?.focus();
                isProcessingListRef.current = false;
                endProgrammaticSelection();
              }, Platform.OS === "android" ? 16 : 0);
            });
            return;
          }
        }
      }

      // Update previous value and call original onChangeText
      previousValueRef.current = newText;
      pendingInternalValueRef.current = newText;
      onChangeText(newText);
    };

    // Update previousValueRef when value changes externally
    useEffect(() => {
      if (!isProcessingListRef.current) {
        if (pendingInternalValueRef.current !== null) {
          if (pendingInternalValueRef.current === value) {
            pendingInternalValueRef.current = null;
            previousValueRef.current = value;
            return;
          }
          pendingInternalValueRef.current = null;
        }

        // External value update (e.g. note load/refresh) - reset history.
        previousValueRef.current = value;
        undoStackRef.current = [];
        redoStackRef.current = [];
      }
    }, [value]);

    const applyTextAndSelection = (
      nextText: string,
      nextSelection: { start: number; end: number },
      options?: { skipHistory?: boolean }
    ) => {
      if (isPreview || !inputRef.current) return;

      const currentText = previousValueRef.current;
      if (!options?.skipHistory && currentText !== nextText) {
        pushUndoSnapshot({ text: currentText, selection: selectionRef.current });
        redoStackRef.current = [];
      }

      beginProgrammaticSelection(nextSelection);
      previousValueRef.current = nextText;
      pendingInternalValueRef.current = nextText;
      onChangeText(nextText);
      inputRef.current?.focus();

      const setCursorPosition = () => {
        if (Platform.OS === "web") {
          const input = inputRef.current as any;
          if (input && input.setSelectionRange) {
            input.setSelectionRange(nextSelection.start, nextSelection.end);
          } else if (input && input.selectionStart !== undefined) {
            input.selectionStart = nextSelection.start;
            input.selectionEnd = nextSelection.end;
          }
        } else {
          const input = inputRef.current as any;
          if (input && typeof input.setNativeProps === "function") {
            input.setNativeProps({
              selection: { start: nextSelection.start, end: nextSelection.end },
            });
          }
          inputRef.current?.focus();
        }
        endProgrammaticSelection();
      };

      requestAnimationFrame(() => {
        setTimeout(setCursorPosition, Platform.OS === "android" ? 16 : 0);
      });
    };

    const insertTextAtSelection = (text: string, cursorOffset?: number) => {
      if (isPreview || !inputRef.current) return;

      const start = selection.start;
      const end = selection.end;
      const currentText = previousValueRef.current;
      const beforeText = currentText.substring(0, start);
      const afterText = currentText.substring(end);
      const nextText = beforeText + text + afterText;
      const newCursorPosition = start + (cursorOffset ?? text.length);

      applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
    };

    const indentAtSelection = () => {
      if (isPreview || !inputRef.current) return;

      const start = selection.start;
      const end = selection.end;
      const currentText = previousValueRef.current;

      // No selection: behave like inserting TAB_SPACES at cursor
      if (start === end) {
        insertTextAtSelection(TAB_SPACES, TAB_SPACES.length);
        return;
      }

      // Selection: indent each line touched by the selection (prepend TAB_SPACES)
      const blockStart = currentText.lastIndexOf("\n", start - 1) + 1;
      let blockEnd = value.indexOf("\n", end);
      if (blockEnd === -1) blockEnd = currentText.length;

      const block = currentText.slice(blockStart, blockEnd);
      const lines = block.split("\n");

      const insertionStarts: number[] = [];
      let runningIndex = blockStart;
      const nextLines = lines.map((line) => {
        insertionStarts.push(runningIndex);
        // advance using ORIGINAL line length (+ newline)
        runningIndex += line.length + 1;
        return TAB_SPACES + line;
      });

      const nextBlock = nextLines.join("\n");
      const nextText = currentText.slice(0, blockStart) + nextBlock + currentText.slice(blockEnd);

      const adjustPos = (pos: number) => {
        let nextPos = pos;
        for (const p of insertionStarts) {
          if (pos < p) continue;
          nextPos += TAB_SPACES.length;
        }
        return nextPos;
      };

      applyTextAndSelection(nextText, { start: adjustPos(start), end: adjustPos(end) });
    };

    const unindentAtSelection = () => {
      if (isPreview || !inputRef.current) return;

      const start = selection.start;
      const end = selection.end;
      const currentText = previousValueRef.current;

      // No selection: remove one indent level immediately before cursor if present
      if (start === end) {
        if (start >= TAB_SPACES.length && currentText.substring(start - TAB_SPACES.length, start) === TAB_SPACES) {
          const nextText = currentText.substring(0, start - TAB_SPACES.length) + currentText.substring(end);
          const nextPos = start - TAB_SPACES.length;
          applyTextAndSelection(nextText, { start: nextPos, end: nextPos });
        }
        return;
      }

      // Selection: unindent each line touched by the selection (remove leading TAB_SPACES)
      const blockStart = currentText.lastIndexOf("\n", start - 1) + 1;
      let blockEnd = currentText.indexOf("\n", end);
      if (blockEnd === -1) blockEnd = currentText.length;

      const block = currentText.slice(blockStart, blockEnd);
      const lines = block.split("\n");

      const removalStarts: number[] = [];
      let runningIndex = blockStart;
      const nextLines = lines.map((line) => {
        const didRemove = line.startsWith(TAB_SPACES);
        if (didRemove) {
          removalStarts.push(runningIndex);
        }
        // advance using ORIGINAL line length (+ newline)
        runningIndex += line.length + 1;
        return didRemove ? line.slice(TAB_SPACES.length) : line;
      });

      // If nothing to unindent, keep selection as-is
      if (removalStarts.length === 0) return;

      const nextBlock = nextLines.join("\n");
      const nextText = currentText.slice(0, blockStart) + nextBlock + currentText.slice(blockEnd);

      const adjustPos = (pos: number) => {
        let nextPos = pos;
        for (const p of removalStarts) {
          if (pos <= p) continue;
          const delta = pos - p;
          nextPos -= delta < TAB_SPACES.length ? delta : TAB_SPACES.length;
        }
        return nextPos;
      };

      applyTextAndSelection(nextText, { start: adjustPos(start), end: adjustPos(end) });
    };

    const getWebInputElement = (): any => {
      const refAny = inputRef.current as any;
      if (!refAny) return null;

      // In some react-native-web setups, the ref is the DOM element already.
      if (typeof refAny.addEventListener === "function") return refAny;

      // Try common helpers/fields across RNW versions.
      if (typeof refAny.getNode === "function") return refAny.getNode();
      if (typeof refAny.getNativeRef === "function") return refAny.getNativeRef();
      if (typeof refAny.getInputNode === "function") return refAny.getInputNode();

      if (refAny._node && typeof refAny._node.addEventListener === "function") return refAny._node;
      if (refAny._inputRef && typeof refAny._inputRef.addEventListener === "function") return refAny._inputRef;
      if (refAny._inputElement && typeof refAny._inputElement.addEventListener === "function") return refAny._inputElement;

      return null;
    };

    const handleTabKey = (e: any) => {
      const key = e?.key ?? e?.nativeEvent?.key;
      if (key !== "Tab") return;

      e?.preventDefault?.();
      e?.stopPropagation?.();
      e?.stopImmediatePropagation?.();

      // Shift+Tab: unindent; Tab: indent
      if (e?.shiftKey) {
        unindentAtSelection();
      } else {
        indentAtSelection();
      }
    };

    // Web: ensure Tab doesn't move focus away (RNW doesn't always forward onKeyDown for Tab).
    useEffect(() => {
      if (Platform.OS !== "web") return;
      if (typeof document === "undefined") return;

      const handleDocumentKeyDownCapture = (e: any) => {
        const el = getWebInputElement();
        const active = document.activeElement as any;
        const isEditorFocused = !!el && !!active && (active === el || (typeof el.contains === "function" && el.contains(active)));
        if (!isEditorFocused) return;

        if (e?.isComposing) return;

        const key = (e?.key ?? "").toLowerCase();
        const isCmdOrCtrl = !!e?.metaKey || !!e?.ctrlKey;

        // Undo / Redo
        if (isCmdOrCtrl && key === "z") {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          e?.stopImmediatePropagation?.();

          if (e?.shiftKey) {
            // Cmd/Ctrl + Shift + Z => Redo
            const canRedo = redoStackRef.current.length > 0;
            if (!canRedo) return;

            const currentText = previousValueRef.current;
            const currentSel = selectionRef.current;
            const snap = redoStackRef.current.pop()!;
            pushUndoSnapshot({ text: currentText, selection: currentSel });
            applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
          } else {
            // Cmd/Ctrl + Z => Undo
            const canUndo = undoStackRef.current.length > 0;
            if (!canUndo) return;

            const currentText = previousValueRef.current;
            const currentSel = selectionRef.current;
            const snap = undoStackRef.current.pop()!;
            pushRedoSnapshot({ text: currentText, selection: currentSel });
            applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
          }
          return;
        }

        // Tab indentation
        if (e?.key === "Tab") {
          handleTabKey(e);
        }
      };

      document.addEventListener("keydown", handleDocumentKeyDownCapture, true);
      return () => {
        document.removeEventListener("keydown", handleDocumentKeyDownCapture, true);
      };
    }, [insertTextAtSelection]);

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset?: number) => {
        insertTextAtSelection(text, cursorOffset);
      },
      wrapSelection: (before: string, after: string, cursorOffset?: number) => {
        if (isPreview || !inputRef.current) return;

        const start = selection.start;
        const end = selection.end;
        const currentText = previousValueRef.current;
        const selectedText = currentText.substring(start, end);

        // If there's selected text, wrap it; otherwise insert the formatting markers
        let nextText: string;
        let newCursorPosition: number;

        if (selectedText.length > 0) {
          // Wrap selected text - place cursor at the end of the wrapped text
          nextText = currentText.substring(0, start) + before + selectedText + after + currentText.substring(end);
          newCursorPosition = start + before.length + selectedText.length + after.length;
        } else {
          // No selection, insert formatting markers with cursor positioned according to cursorOffset
          nextText = currentText.substring(0, start) + before + after + currentText.substring(end);
          // cursorOffset should position cursor between before and after markers
          // e.g., for "**" + "**" with offset 2, cursor should be at start + 2 (after first "**")
          newCursorPosition = start + (cursorOffset ?? before.length);
        }

        applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
      },
      indent: () => {
        indentAtSelection();
      },
      outdent: () => {
        unindentAtSelection();
      },
      undo: () => {
        if (isPreview || !inputRef.current) return;
        if (undoStackRef.current.length === 0) return;

        const currentText = previousValueRef.current;
        const currentSel = selectionRef.current;
        const snap = undoStackRef.current.pop()!;
        pushRedoSnapshot({ text: currentText, selection: currentSel });
        applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
      },
      redo: () => {
        if (isPreview || !inputRef.current) return;
        if (redoStackRef.current.length === 0) return;

        const currentText = previousValueRef.current;
        const currentSel = selectionRef.current;
        const snap = redoStackRef.current.pop()!;
        pushUndoSnapshot({ text: currentText, selection: currentSel });
        applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
      },
      canUndo: () => undoStackRef.current.length > 0,
      canRedo: () => redoStackRef.current.length > 0,
      focus: () => {
        inputRef.current?.focus();
      },
      getSelection: () => selection,
    }));

    const markdownStyles = {
      body: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        // fontFamily: "monospace",
      },
      heading1: {
        color: colors.foreground,
        fontSize: 32,
        fontWeight: "bold" as const,
        marginTop: 16,
        marginBottom: 8,
        lineHeight: 32,
        // fontFamily: "monospace",
      },
      heading2: {
        color: colors.foreground,
        fontSize: 28,
        fontWeight: "bold" as const,
        marginTop: 14,
        marginBottom: 7,
        lineHeight: 28,
        // fontFamily: "monospace",
      },
      heading3: {
        color: colors.foreground,
        fontSize: 24,
        fontWeight: "600" as const,
        marginTop: 12,
        marginBottom: 6,
        lineHeight: 24,
        // fontFamily: "monospace",
      },
      heading4: {
        color: colors.foreground,
        fontSize: 20,
        fontWeight: "600" as const,
        marginTop: 10,
        marginBottom: 5,
        lineHeight: 20,
        // fontFamily: "monospace",
      },
      paragraph: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        marginTop: 8,
        marginBottom: 8,
        // fontFamily: "monospace",
      },
      strong: {
        fontWeight: "bold" as const,
        color: colors.foreground,
        // fontFamily: "monospace",
      },
      em: {
        fontStyle: "italic" as const,
        color: colors.foreground,
        // fontFamily: "monospace",
      },
      code_inline: {
        color: "#FF69B4",
        fontSize: 14,
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
        borderWidth: 1,
        borderColor: colors.ring,
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
        borderWidth: 1,
        borderColor: colors.ring,
      },
      blockquote: {
        backgroundColor: colors.muted,
        borderLeftWidth: 4,
        borderLeftColor: colors.ring,
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
        // fontFamily: "monospace",
      },
      bullet_list: {
        marginTop: 8,
        marginBottom: 8,
        paddingLeft: 8,
      },
      ordered_list: {
        marginTop: 8,
        marginBottom: 8,
        paddingLeft: 8,
      },
      list_item: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        marginTop: 4,
        marginBottom: 4,
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        // fontFamily: "monospace",
      },
      link: {
        color: "#3b82f6",
        textDecorationLine: "underline" as const,
        // fontFamily: "monospace",
      },
      table: {
        borderWidth: 1,
        borderColor: colors.ring,
        borderRadius: 4,
        marginTop: 8,
        marginBottom: 8,
        overflow: "hidden" as const,
      },
      thead: {
        backgroundColor: colors.muted,
      },
      tbody: {
        backgroundColor: colors.muted,
      },
      th: {
        borderWidth: 1,
        borderColor: colors.ring,
        padding: 8,
        fontWeight: "bold" as const,
        color: colors.foreground,
        fontSize: 14,
      },
      tr: {
        borderBottomWidth: 1,
        borderBottomColor: colors.ring,
      },
      td: {
        borderWidth: 1,
        borderColor: colors.ring,
        padding: 8,
        color: colors.foreground,
        fontSize: 14,
      },
      hr: {
        backgroundColor: colors.ring,
        height: 1,
        marginTop: 16,
        marginBottom: 16,
        borderWidth: 0,
      },
    };

    // Helper function to toggle checkbox using the helper from markdown-toolbar
    const toggleCheckbox = (lineIndex: number) => {
      const newValue = toggleCheckboxInMarkdown(value, lineIndex);
      if (newValue !== value) {
        onChangeText(newValue);
      }
    };

    // Pre-process markdown to extract checkbox information
    const checkboxData = useMemo(() => {
      const lines = value.split('\n');
      const checkboxLines: Array<{
        lineIndex: number;
        info: { hasCheckbox: boolean; isChecked: boolean; prefix: string; restText: string; fullMatch: string }
      }> = [];

      lines.forEach((line, index) => {
        const checkboxInfo = detectCheckboxInLine(line);
        if (checkboxInfo?.hasCheckbox) {
          checkboxLines.push({ lineIndex: index, info: checkboxInfo });
        }
      });

      return checkboxLines;
    }, [value]);

    // Track rendered checkboxes using a ref to avoid re-render issues
    const renderedCheckboxesRef = useRef<Set<number>>(new Set());

    // Track the last value to detect changes synchronously
    const lastValueRef = useRef<string>(value);
    const lastPreviewRef = useRef<boolean>(isPreview);

    // Clear rendered checkboxes synchronously when value or preview mode changes
    // This must happen before markdownRules is created to ensure fresh state
    if (lastValueRef.current !== value || lastPreviewRef.current !== isPreview) {
      renderedCheckboxesRef.current.clear();
      lastValueRef.current = value;
      lastPreviewRef.current = isPreview;
    }

    // Also clear in useEffect as a safety net (though synchronous clearing above should handle it)
    useEffect(() => {
      renderedCheckboxesRef.current.clear();
    }, [value, isPreview]);

    // Helper function to extract plain text from React children
    const extractTextFromChildren = (children: any, preserveNewlines: boolean = false): string => {
      if (typeof children === 'string') {
        return preserveNewlines ? children : children.trim();
      }
      if (Array.isArray(children)) {
        const separator = preserveNewlines ? '' : ' ';
        return children
          .map((child) => extractTextFromChildren(child, preserveNewlines))
          .join(separator)
          .trim();
      }
      if (children && typeof children === 'object' && 'props' in children) {
        const childProps = children.props as any;
        if (childProps.children) {
          return extractTextFromChildren(childProps.children, preserveNewlines);
        }
        // Check if it's a Text component with children
        if (typeof childProps.children === 'string') {
          return preserveNewlines ? childProps.children : childProps.children.trim();
        }
      }
      return '';
    };

    // Helper function to normalize text for comparison (remove markdown formatting artifacts)
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Helper to strip markdown link syntax for matching.
    // This prevents URL-heavy markdown like `[Google](https://google.com)` from breaking
    // checkbox line matching (children render as "Google", but the source includes the URL).
    const stripLinksForMatching = (text: string): string => {
      return text
        // Images: ![alt](url) -> alt
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
        // Inline links: [text](url "title") -> text
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        // Reference links: [text][id] or [text][] -> text
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
        // Autolinks: <https://example.com> -> https://example.com
        .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1');
    };

    // Linkify bare URLs/emails in preview without touching the underlying editor value.
    // Examples:
    // - https://example.com  -> <https://example.com>
    // - www.example.com      -> [www.example.com](https://www.example.com)
    // - foo@bar.com          -> <foo@bar.com>
    //
    // Skips fenced code blocks (```), indented code blocks, inline code (`code`),
    // and existing markdown link syntaxes so we don't double-wrap.
    const linkifyMarkdown = (markdown: string): string => {
      const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
      const URL_RE = /\b(?:https?:\/\/|www\.|mailto:|tel:)[^\s<>()]+/gi;

      const linkifyPlainText = (text: string): string => {
        const placeholders: string[] = [];
        const tokenFor = (idx: number) => `\u0000${idx}\u0000`;
        const mask = (re: RegExp, input: string) =>
          input.replace(re, (m) => {
            const idx = placeholders.push(m) - 1;
            return tokenFor(idx);
          });
        const unmask = (input: string) =>
          input.replace(/\u0000(\d+)\u0000/g, (_m, n) => placeholders[Number(n)] ?? _m);

        // Protect existing markdown link constructs so we don't double-linkify.
        let masked = text;
        masked = mask(/!\[[^\]]*\]\([^)]+\)/g, masked);      // images
        masked = mask(/\[[^\]]+\]\([^)]+\)/g, masked);       // inline links
        masked = mask(/\[[^\]]+\]\[[^\]]*\]/g, masked);      // reference links
        masked = mask(/<[^>\s]+>/g, masked);                 // autolinks / html-ish

        const stripTrailingPunctuation = (raw: string) => {
          let core = raw;
          let trailing = "";
          while (core.length > 0 && /[)\].,!?;:'"]/.test(core[core.length - 1])) {
            trailing = core[core.length - 1] + trailing;
            core = core.slice(0, -1);
          }
          return { core, trailing };
        };

        // Emails first so we don't partially match inside mailto:foo@bar.com
        masked = masked.replace(EMAIL_RE, (raw) => {
          const { core, trailing } = stripTrailingPunctuation(raw);
          if (!core) return raw;
          return `<${core}>${trailing}`;
        });

        masked = masked.replace(URL_RE, (raw) => {
          const { core, trailing } = stripTrailingPunctuation(raw);
          if (!core) return raw;

          if (core.toLowerCase().startsWith("www.")) {
            const href = `https://${core}`;
            return `[${core}](${href})${trailing}`;
          }

          // For scheme URLs, autolink form is compact and widely supported by markdown parsers.
          return `<${core}>${trailing}`;
        });

        return unmask(masked);
      };

      const lines = markdown.split("\n");
      let inFence = false;

      const out = lines.map((line) => {
        if (/^\s*```/.test(line)) {
          inFence = !inFence;
          return line;
        }
        if (inFence) return line;
        if (/^(?:\t| {4})/.test(line)) return line; // indented code block

        // Naive inline-code protection: split on backticks and only linkify even segments.
        const parts = line.split("`");
        for (let i = 0; i < parts.length; i += 2) {
          parts[i] = linkifyPlainText(parts[i] ?? "");
        }
        return parts.join("`");
      });

      return out.join("\n");
    };

    // Helper function to ensure children have keys when they're arrays
    const ensureChildrenKeys = (children: any): any => {
      if (Array.isArray(children)) {
        return children.map((child, index) => {
          if (React.isValidElement(child) && !child.key) {
            return React.cloneElement(child, { key: `child-${index}` });
          }
          return child;
        });
      }
      return children;
    };

    // Helper function to remove checkbox markdown syntax from children
    // Handles patterns like: "[ ]", "[x]", "[X]", "[*]", "-[ ]", "- [x]", etc.
    const removeCheckboxFromChildren = (children: any): any => {
      // Comprehensive regex to match checkbox patterns at the start
      const checkboxPatterns = [
        /^\s*\[[\s*xX*]\]\s*/,           // [ ], [x], [X], [*]
        /^\s*[-*+]\s*\[[\s*xX*]\]\s*/,   // -[ ], -[x], *[ ], +[ ]
        /^\s*[-*+]\s+\[[\s*xX*]\]\s*/,   // - [ ], - [x], * [ ], + [ ]
      ];

      if (typeof children === 'string') {
        let cleaned = children;
        let patternMatched = false;
        // Try all patterns
        for (const pattern of checkboxPatterns) {
          if (pattern.test(cleaned)) {
            cleaned = cleaned.replace(pattern, '').trim();
            patternMatched = true;
          }
        }
        // Only trim if a pattern was matched, otherwise preserve the string as-is
        // This is important for preserving spaces in code_inline elements
        if (patternMatched) {
          return cleaned.length > 0 ? cleaned : null;
        }
        // No pattern matched, return string as-is (preserves spaces)
        return cleaned;
      }

      if (Array.isArray(children)) {
        const processed = children
          .map((child) => removeCheckboxFromChildren(child))
          .filter((child) => child !== null && child !== undefined);

        // Check and clean first child if it's a string
        if (processed.length > 0 && typeof processed[0] === 'string') {
          let firstChild = processed[0];
          let cleaned = false;

          for (const pattern of checkboxPatterns) {
            if (pattern.test(firstChild)) {
              firstChild = firstChild.replace(pattern, '').trim();
              cleaned = true;
            }
          }

          if (cleaned) {
            if (firstChild.length === 0) {
              return processed.slice(1);
            }
            return [firstChild, ...processed.slice(1)];
          }
        }

        return processed;
      }

      if (children && typeof children === 'object') {
        // Handle React elements
        if ('type' in children && 'props' in children) {
          const childProps = children.props as any;

          // Preserve code_inline elements as-is to maintain their spacing
          // Check if this is a code_inline element by checking its style characteristics
          if (childProps.style) {
            const elementStyle = Array.isArray(childProps.style)
              ? Object.assign({}, ...childProps.style)
              : childProps.style;

            // code_inline elements have:
            // - monospace fontFamily
            // - backgroundColor (for highlighting)
            // - fontSize of 14
            const isCodeInline =
              elementStyle.fontFamily === 'monospace' &&
              elementStyle.backgroundColor !== undefined &&
              (elementStyle.fontSize === 14 || elementStyle.fontSize === undefined);

            if (isCodeInline) {
              // This is a code_inline element, preserve it as-is to maintain spacing
              return children;
            }
          }

          if (childProps.children) {
            const processedChildren = removeCheckboxFromChildren(childProps.children);
            // Use React.cloneElement to properly clone the element
            return React.cloneElement(children, {
              ...childProps,
              children: processedChildren,
            });
          }
        }
      }

      return children;
    };

    // Create a stable key for Markdown component that changes when value changes
    // This ensures proper remounting when content is refreshed/saved
    const markdownKey = useMemo(() => {
      // Create a simple hash from value for the key
      // Use length + first 200 chars + last 200 chars to ensure uniqueness while being performant
      const hash = value.length > 400
        ? `${value.length}-${value.slice(0, 200)}-${value.slice(-200)}`
        : value;
      return `markdown-${hash}-${isPreview}`;
    }, [value, isPreview]);

    // NOTE (web): Strikethrough is "propagated" to nested inline elements.
    // If `~~` wraps inline code, the line color can come from the *parent* text color (often black),
    // even when the inline code text is pink. To make the code segment's strike match its color,
    // we render strikethrough by applying `textDecorationLine` to each child segment instead of
    // relying on a single parent decoration.
    const withLineThrough = (style: any) => {
      const strike = { textDecorationLine: "line-through" as const };
      if (!style) return strike;
      return Array.isArray(style) ? [...style, strike] : [style, strike];
    };

    const renderStrikeThrough = (node: any, children: any) => {
      const parts = Array.isArray(children) ? children : [children];
      return (
        <RNText key={node.key}>
          {parts.map((child, index) => {
            if (child === null || child === undefined || child === false) return null;

            if (typeof child === "string" || typeof child === "number") {
              return (
                <RNText key={`${node.key}-del-${index}`} style={{ textDecorationLine: "line-through" as const }}>
                  {child}
                </RNText>
              );
            }

            if (React.isValidElement(child)) {
              const element = child as React.ReactElement<any>;
              const childProps: any = element.props ?? {};
              if ("style" in childProps) {
                return React.cloneElement(element, {
                  key: `${node.key}-del-${index}`,
                  style: withLineThrough(childProps.style),
                });
              }
              return React.cloneElement(element, { key: `${node.key}-del-${index}` });
            }

            return null;
          })}
        </RNText>
      );
    };

    // Custom renderer for checkboxes in task lists and code blocks
    const markdownRules = {
      fence: (node: any, children: any, parent: any, styles: any) => {
        // Debug: Log node structure to understand what we're working with
        if (__DEV__) {
          console.log('=== FENCE RENDERER CALLED ===');
          console.log('Node keys:', Object.keys(node));
          console.log('Node content:', node.content);
          console.log('Node source:', node.source);
          console.log('Node info:', node.info);
          console.log('Node language:', node.language);
          console.log('Children:', children);
          console.log('Children type:', typeof children);
        }

        // Extract code and language from the fence node
        // react-native-markdown-display uses node.content for code and node.info for language
        // Try multiple possible properties - preserve newlines for code
        const code = node.content || node.source || extractTextFromChildren(children, true) || '';
        // Language is in node.info (the text after the opening fence)
        const language = (node.info || node.language || '').trim();

        if (__DEV__) {
          console.log('Extracted code length:', code.length);
          console.log('Extracted language:', language);
          console.log('Code preview:', code.substring(0, 100));
        }

        // Always use our custom renderer - don't fall back to default
        // This ensures syntax highlighting is always attempted

        if (__DEV__) {
          console.log('Rendering with SyntaxHighlighter');
        }

        return (
          <View
            key={node.key}
            style={[
              styles.fence,
              {
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.ring,
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
                marginBottom: 8,
              },
            ]}
          >
            <SyntaxHighlighter code={code.trim()} language={language} />
          </View>
        );
      },
      code_block: (node: any, children: any, parent: any, styles: any) => {
        // Extract code from code_block (no language specified)
        // react-native-markdown-display uses node.content for code
        // Try multiple possible properties - preserve newlines for code
        const code = node.content || node.source || extractTextFromChildren(children, true) || '';

        // Always use our custom renderer - don't fall back to default

        return (
          <View
            key={node.key}
            style={[
              styles.code_block,
              {
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.ring,
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
                marginBottom: 8,
              },
            ]}
          >
            <SyntaxHighlighter code={code.trim()} />
          </View>
        );
      },
      code_inline: (node: any, children: any, parent: any, styles: any) => {
        // Extract text content from inline code
        const codeText = node.content || extractTextFromChildren(children) || '';

        // Add space characters at start and end to simulate padding
        // since padding doesn't work on Text components in React Native
        // Use RNText directly to ensure style prop (especially color) is properly applied on web
        return (
          <RNText key={node.key} style={styles.code_inline}>
            {' '}{codeText}{' '}
          </RNText>
        );
      },
      image: (node: any) => {
        const uriRaw =
          node?.attributes?.src ??
          node?.attributes?.href ??
          node?.url ??
          node?.destination ??
          node?.source ??
          "";
        const uri = typeof uriRaw === "string" ? uriRaw : "";
        if (!uri) return null;

        const altRaw = node?.attributes?.alt ?? node?.alt ?? "";
        const alt = typeof altRaw === "string" ? altRaw : undefined;

        const width = previewContentWidth > 0 ? previewContentWidth : 320;
        return <MarkdownPreviewImage key={node.key} uri={uri} alt={alt} maxWidth={width} colors={colors} />;
      },
      // `~~strike~~` (remark AST uses `del` for strikethrough; some configs use `s`)
      del: (node: any, children: any) => renderStrikeThrough(node, children),
      s: (node: any, children: any) => renderStrikeThrough(node, children),
      list_item: (node: any, children: any, parent: any, styles: any) => {
        // Extract text content from children, removing checkbox syntax for matching
        let childrenText = normalizeText(stripLinksForMatching(extractTextFromChildren(children)));
        // Remove all checkbox patterns from extracted text for better matching
        childrenText = childrenText
          .replace(/^\s*\[[\s*xX*]\]\s*/, '')
          .replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '')
          .replace(/^\s*[-*+]\s+\[[\s*xX*]\]\s*/, '')
          .trim();

        // Try to find the best matching checkbox that hasn't been rendered yet
        let bestMatch: {
          lineIndex: number;
          info: { hasCheckbox: boolean; isChecked: boolean; prefix: string; restText: string; fullMatch: string };
          score: number
        } | null = null;

        for (const { lineIndex, info } of checkboxData) {
          if (renderedCheckboxesRef.current.has(lineIndex)) {
            continue; // Skip already rendered checkboxes
          }

          const { restText, isChecked } = info;
          const restTextNormalized = normalizeText(stripLinksForMatching(restText));

          // Calculate match score (higher is better)
          let score = 0;

          // Check if childrenText only contains checkbox-like patterns (should have been removed)
          // This handles cases where restText is empty but markdown parser includes checkbox syntax
          const childrenTextAfterCheckboxRemoval = childrenText
            .replace(/^\s*\[[\s*xX*]\]\s*/, '')
            .replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '')
            .replace(/^\s*[-*+]\s+\[[\s*xX*]\]\s*/, '')
            .trim();

          if (restTextNormalized === '' && (childrenText === '' || childrenTextAfterCheckboxRemoval === '')) {
            score = 100; // Perfect match for empty text (even if checkbox syntax remains in childrenText)
          } else if (restTextNormalized !== '' && childrenText !== '') {
            // Compare with cleaned childrenText (after checkbox removal)
            const cleanedChildrenText = childrenTextAfterCheckboxRemoval || childrenText;

            if (cleanedChildrenText === restTextNormalized) {
              score = 100; // Exact match
            } else if (cleanedChildrenText.includes(restTextNormalized) || restTextNormalized.includes(cleanedChildrenText)) {
              // Partial match - calculate similarity
              const longer = restTextNormalized.length > cleanedChildrenText.length ? restTextNormalized : cleanedChildrenText;
              const shorter = restTextNormalized.length > cleanedChildrenText.length ? cleanedChildrenText : restTextNormalized;
              score = (shorter.length / longer.length) * 80; // Similarity score
            } else {
              // Check word-level similarity
              const restWords = restTextNormalized.split(/\s+/).filter(w => w.length > 0);
              const childrenWords = cleanedChildrenText.split(/\s+/).filter(w => w.length > 0);
              const commonWords = restWords.filter(w => childrenWords.includes(w));
              if (commonWords.length > 0) {
                score = (commonWords.length / Math.max(restWords.length, childrenWords.length)) * 60;
              }
            }
          } else if (restTextNormalized === '' && childrenTextAfterCheckboxRemoval !== '') {
            // restText is empty but childrenText has content after removing checkbox patterns
            // This shouldn't match, score remains 0
          }

          // Prefer matches with higher scores, and if scores are equal, prefer earlier lines
          // Lower the threshold to 30 to catch more matches
          if (score > 30 && (!bestMatch || score > bestMatch.score || (score === bestMatch.score && lineIndex < bestMatch.lineIndex))) {
            bestMatch = { lineIndex, info, score };
          }
        }

        // Also check if children contain checkbox-like patterns even if matching failed
        // This helps catch cases where the markdown parser includes the checkbox syntax
        const childrenRawText = extractTextFromChildren(children);
        const hasCheckboxPattern = /\[[\s*xX*]\]/.test(childrenRawText) || /[-*+]\s*\[[\s*xX*]\]/.test(childrenRawText);

        if (bestMatch || hasCheckboxPattern) {
          // If we have a best match, use it; otherwise find the first unmatched checkbox
          let checkboxToRender = bestMatch;

          if (!checkboxToRender && hasCheckboxPattern) {
            // Find the first unmatched checkbox line
            // Try to find one that matches the checkbox state in the children
            const checkboxStateMatch = childrenRawText.match(/\[([\s*xX*])\]/);
            const detectedState = checkboxStateMatch ? checkboxStateMatch[1] : null;
            const detectedIsChecked = detectedState === 'x' || detectedState === 'X' || detectedState === '*';

            // First, try to find a checkbox that matches both state and hasn't been rendered
            for (const { lineIndex, info } of checkboxData) {
              if (!renderedCheckboxesRef.current.has(lineIndex)) {
                // Prefer matching checkbox state if detected
                if (detectedState === null || info.isChecked === detectedIsChecked) {
                  checkboxToRender = { lineIndex, info, score: 50 };
                  break;
                }
              }
            }

            // If still no match found, use the first unmatched checkbox anyway (state doesn't matter)
            if (!checkboxToRender) {
              for (const { lineIndex, info } of checkboxData) {
                if (!renderedCheckboxesRef.current.has(lineIndex)) {
                  checkboxToRender = { lineIndex, info, score: 40 };
                  break;
                }
              }
            }

            // If we still don't have a match but detected checkbox pattern, 
            // create a synthetic checkbox from the detected pattern
            // This handles edge cases where checkboxData might be out of sync
            if (!checkboxToRender && detectedState !== null) {
              // Extract text after checkbox pattern
              const textAfterCheckbox = childrenRawText
                .replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '')
                .replace(/^\s*\[[\s*xX*]\]\s*/, '')
                .trim();

              // Find any checkbox line that matches the text (even if already rendered)
              // This is a fallback for when ref tracking gets out of sync
              for (const { lineIndex, info } of checkboxData) {
                const restTextNormalized = normalizeText(stripLinksForMatching(info.restText));
                const textAfterNormalized = normalizeText(stripLinksForMatching(textAfterCheckbox));
                if (restTextNormalized === textAfterNormalized ||
                  (restTextNormalized === '' && textAfterNormalized === '') ||
                  (restTextNormalized !== '' && textAfterNormalized.includes(restTextNormalized))) {
                  checkboxToRender = { lineIndex, info, score: 35 };
                  break;
                }
              }
            }
          }

          if (checkboxToRender) {
            const { lineIndex, info } = checkboxToRender;
            const { isChecked, restText } = info;

            // Mark this checkbox as rendered
            renderedCheckboxesRef.current.add(lineIndex);

            // Remove checkbox markdown syntax from children before rendering
            let cleanedChildren = removeCheckboxFromChildren(children);

            // Fallback: if cleaning resulted in empty/null, use restText from the checkbox info
            if (!cleanedChildren || (Array.isArray(cleanedChildren) && cleanedChildren.length === 0)) {
              cleanedChildren = restText ? <Text style={styles.body}>{restText}</Text> : null;
            }

            // If cleanedChildren is still problematic, ensure we have valid content
            if (!cleanedChildren && restText) {
              cleanedChildren = <Text style={styles.body}>{restText}</Text>;
            }

            const childrenToRender = cleanedChildren || children;
            const childrenWithKeys = ensureChildrenKeys(childrenToRender);
            return (
              <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                <Pressable
                  onPress={() => {
                    toggleCheckbox(lineIndex);
                  }}
                  style={{ marginRight: 8, marginTop: 4.5 }}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => {
                      toggleCheckbox(lineIndex);
                    }}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  {childrenWithKeys}
                </View>
              </View>
            );
          }
        }

        // Default list item rendering - ensure proper row layout for regular list items
        const defaultRenderer = renderRules?.list_item;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          // Ensure the rendered component has flexDirection: row
          if (rendered && React.isValidElement(rendered)) {
            const element = rendered as React.ReactElement<{ style?: any; children?: any }>;
            const existingStyle = Array.isArray(element.props.style)
              ? element.props.style
              : element.props.style ? [element.props.style] : [];
            // Ensure children have keys if they're arrays
            const childrenWithKeys = element.props.children ? ensureChildrenKeys(element.props.children) : element.props.children;
            return React.cloneElement(element, {
              style: [
                ...existingStyle,
                { flexDirection: 'row', alignItems: 'flex-start' }
              ],
              children: childrenWithKeys,
            });
          }
          return rendered;
        }
        // Fallback to default rendering with row layout
        const childrenWithKeys = ensureChildrenKeys(children);
        return (
          <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
            {childrenWithKeys}
          </View>
        );
      },
      bullet_list: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.bullet_list}>
            {children}
          </View>
        );
      },
      ordered_list: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.ordered_list}>
            {children}
          </View>
        );
      },
      table: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.table}>
            {children}
          </View>
        );
      },
      thead: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.thead}>
            {children}
          </View>
        );
      },
      tbody: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.tbody}>
            {children}
          </View>
        );
      },
      tr: (node: any, children: any, parent: any, styles: any) => {
        // Ensure children is an array for proper rendering
        const rowChildren = Array.isArray(children) ? children : [children];
        return (
          <View
            key={node.key}
            style={[
              styles.tr,
              {
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: colors.ring,
              }
            ]}
          >
            {rowChildren}
          </View>
        );
      },
      th: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View
            key={node.key}
            style={[
              styles.th,
              {
                flex: 1,
                borderWidth: 1,
                borderColor: colors.ring,
                padding: 8,
                backgroundColor: colors.muted,
                minWidth: 0, // Allow flex shrinking
              }
            ]}
          >
            <Text style={{ fontWeight: 'bold', color: colors.foreground, fontSize: 14 }}>
              {children}
            </Text>
          </View>
        );
      },
      td: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View
            key={node.key}
            style={[
              styles.td,
              {
                flex: 1,
                borderWidth: 1,
                borderColor: colors.ring,
                padding: 8,
                minWidth: 0, // Allow flex shrinking
              }
            ]}
          >
            <Text style={{ color: colors.foreground, fontSize: 14 }}>
              {children}
            </Text>
          </View>
        );
      },
      hr: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View
            key={node.key}
            style={[
              styles.hr,
              {
                backgroundColor: colors.ring,
                height: 1,
                marginTop: 16,
                marginBottom: 16,
                width: "100%",
              },
            ]}
          />
        );
      },
    };

    const handleWebKeyDown = (e: any) => {
      // On web, `Tab` defaults to moving focus. Instead, insert spaces (same as toolbar "Tab").
      handleTabKey(e);
    };

    const syntaxPalette = useMemo(
      () => (isDark ? MARKDOWN_EDITOR_SYNTAX_COLORS.dark : MARKDOWN_EDITOR_SYNTAX_COLORS.light),
      [isDark]
    );

    const selectionAccent = isDark ? "#60a5fa" : "#2563eb";

    const highlightedEditingText = useMemo(() => {
      if (isPreview) return null;
      if (!value) return null;
      return renderHighlightedMarkdownDocument(value, syntaxPalette);
    }, [isPreview, value, syntaxPalette]);

    // Editing mode scroll:
    // Don't rely on TextInput's `onScroll` (platform support is inconsistent).
    // Instead, make the *container* scroll and expand the TextInput to content height.
    const [editorViewportHeight, setEditorViewportHeight] = useState(0);
    const [editorContentHeight, setEditorContentHeight] = useState(0);
    const editorHeight = useMemo(
      () => Math.max(editorViewportHeight, editorContentHeight),
      [editorViewportHeight, editorContentHeight]
    );

    const previewValue = useMemo(() => {
      if (!isPreview) return value;
      return linkifyMarkdown(value);
    }, [value, isPreview]);

    return (
      <View className={cn("flex-1", className)}>
        {/* Editor or Preview */}
        {isPreview ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 32,
              paddingTop: 20,
              paddingBottom: 80,
            }}
          >
            {value ? (
              <View
                style={{ width: "100%" }}
                onLayout={(e) => {
                  const w = e?.nativeEvent?.layout?.width ?? 0;
                  if (!w || w === previewContentWidth) return;
                  setPreviewContentWidth(w);
                }}
              >
                <Markdown
                  key={markdownKey}
                  style={markdownStyles}
                  rules={markdownRules}
                  mergeStyle={false}
                >
                  {previewValue}
                </Markdown>
              </View>
            ) : (
              <Text className="text-muted-foreground italic">{placeholder}</Text>
            )}
          </ScrollView>
        ) : (
          <View
            style={{ flex: 1, minHeight: 0 }}
            onLayout={(e) => {
              const h = e?.nativeEvent?.layout?.height ?? 0;
              if (!h || h === editorViewportHeight) return;
              setEditorViewportHeight(h);
            }}
          >
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, minHeight: editorViewportHeight || undefined }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            >
              <View
                style={{
                  minHeight: editorViewportHeight || undefined,
                  height: editorHeight || undefined,
                  position: "relative",
                }}
              >
                {!!highlightedEditingText && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 1,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 32,
                        paddingTop: 30,
                        paddingBottom: 65,
                      }}
                    >
                      <RNText
                        style={{
                          fontFamily: "monospace",
                          fontSize: 16,
                          lineHeight: 24,
                          color: syntaxPalette.text,
                          ...(Platform.OS === "web" ? ({ whiteSpace: "pre-wrap" } as any) : null),
                        }}
                      >
                        {highlightedEditingText}
                      </RNText>
                    </View>
                  </View>
                )}

                <Input
                  ref={inputRef}
                  className="border-0 shadow-none bg-transparent text-base leading-6 font-mono px-8"
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={value}
                  onChangeText={handleTextChange}
                  selection={selection}
                  selectionColor={selectionAccent}
                  {...(Platform.OS === "web" ? ({ onKeyDown: handleWebKeyDown } as any) : {})}
                  onSelectionChange={(e) => {
                    const next = e.nativeEvent.selection;
                    const pending = pendingSelectionRef.current;

                    // During programmatic updates, ignore transient selection events (often {0,0} on Android)
                    if (isProcessingListRef.current || suppressSelectionUpdatesRef.current > 0) {
                      if (!pending || pending.start !== next.start || pending.end !== next.end) {
                        return;
                      }
                    }

                    setSelectionBoth({ start: next.start, end: next.end });
                  }}
                  onContentSizeChange={(e) => {
                    const h = e?.nativeEvent?.contentSize?.height ?? 0;
                    if (!h || h === editorContentHeight) return;
                    setEditorContentHeight(h);
                  }}
                  multiline
                  scrollEnabled={false}
                  blurOnSubmit={false}
                  textAlignVertical="top"
                  style={{
                    paddingHorizontal: 32,
                    paddingTop: 30,
                    paddingBottom: 65,
                    fontFamily: "monospace",
                    minHeight: editorViewportHeight || undefined,
                    height: editorHeight || undefined,
                    position: "relative",
                    zIndex: 2,
                    // Hide the raw TextInput glyphs; the overlay paints colored text.
                    color: "transparent",
                    ...(Platform.OS === "web" ? ({ caretColor: selectionAccent } as any) : null),
                  }}
                />
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }
);
