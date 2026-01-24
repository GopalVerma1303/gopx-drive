import { detectCheckboxInLine, toggleCheckboxInMarkdown } from "@/components/markdown-toolbar";
import { SyntaxHighlighter } from "@/components/syntax-highlighter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getMarkdownEditorWebViewHtml } from "@/components/markdown-editor-webview-html";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text as RNText, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import Markdown, { renderRules } from "react-native-markdown-display";
import WebView from "react-native-webview";

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
    const { width: windowWidth } = useWindowDimensions();
    const inputRef = useRef<TextInput>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const previousValueRef = useRef<string>(value);
    const isProcessingListRef = useRef<boolean>(false);
    const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const suppressSelectionUpdatesRef = useRef<number>(0);

    // CodeMirror (web) state
    const webCmViewRef = useRef<any>(null);
    const webCmSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

    // WebView-based editor (native) state
    const webViewRef = useRef<any>(null);
    const webViewSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
    const [webViewReady, setWebViewReady] = useState(false);
    const [forcePlainEditor, setForcePlainEditor] = useState(false);
    const lastKnownEditorValueRef = useRef<string>(value);

    const editorLayout = useMemo(() => {
      // Responsive defaults that match the existing look on larger screens,
      // but reduce padding/font size on phones.
      if (windowWidth <= 420) {
        return {
          padX: 16,
          padTop: 22,
          padBottom: 60,
          fontSize: 15,
          lineHeight: 22,
          previewPadTop: 16,
          previewPadBottom: 72,
        };
      }
      if (windowWidth <= 768) {
        return {
          padX: 24,
          padTop: 26,
          padBottom: 65,
          fontSize: 16,
          lineHeight: 24,
          previewPadTop: 18,
          previewPadBottom: 76,
        };
      }
      return {
        padX: 32,
        padTop: 30,
        padBottom: 65,
        fontSize: 16,
        lineHeight: 24,
        previewPadTop: 20,
        previewPadBottom: 80,
      };
    }, [windowWidth]);

    const editorTheme = useMemo(() => {
      const selectionColor = isDark ? "rgba(250,250,250,0.18)" : "rgba(10,10,10,0.12)";
      return {
        dark: isDark,
        // Match the note editor container (`bg-muted`) so the editor surface is always dark in dark mode.
        background: colors.muted,
        foreground: colors.foreground,
        caret: colors.foreground,
        selection: selectionColor,
        gutterForeground: colors.mutedForeground,
        lineHighlight: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        placeholder: colors.mutedForeground,
        padX: editorLayout.padX,
        padTop: editorLayout.padTop,
        padBottom: editorLayout.padBottom,
        fontSize: editorLayout.fontSize,
        lineHeight: editorLayout.lineHeight,
      };
    }, [colors, editorLayout, isDark]);

    // Keep a ref of the latest `value` prop to avoid stale closures in message handlers.
    const latestValueRef = useRef(value);
    useEffect(() => {
      latestValueRef.current = value;
    }, [value]);

    const onChangeTextRef = useRef(onChangeText);
    useEffect(() => {
      onChangeTextRef.current = onChangeText;
    }, [onChangeText]);

    const postToWebView = useCallback((message: any) => {
      try {
        webViewRef.current?.postMessage(JSON.stringify(message));
      } catch {
        // no-op
      }
    }, []);

    const webViewHtml = useMemo(() => getMarkdownEditorWebViewHtml(), []);

    const handleWebViewMessage = useCallback(
      (event: any) => {
        const raw = event?.nativeEvent?.data;
        if (typeof raw !== "string") return;

        let msg: any = null;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "ready") {
          setWebViewReady(true);
          postToWebView({
            type: "init",
            value: latestValueRef.current,
            placeholder,
            theme: editorTheme,
          });
          return;
        }

        if (msg.type === "error") {
          setForcePlainEditor(true);
          return;
        }

        if (msg.type === "selection" && msg.selection) {
          const start = typeof msg.selection.start === "number" ? msg.selection.start : 0;
          const end = typeof msg.selection.end === "number" ? msg.selection.end : start;
          webViewSelectionRef.current = { start, end };
          return;
        }

        if (msg.type === "change") {
          const nextValue = typeof msg.value === "string" ? msg.value : "";
          lastKnownEditorValueRef.current = nextValue;

          if (msg.selection) {
            const start = typeof msg.selection.start === "number" ? msg.selection.start : 0;
            const end = typeof msg.selection.end === "number" ? msg.selection.end : start;
            webViewSelectionRef.current = { start, end };
          }

          if (nextValue !== latestValueRef.current) {
            onChangeTextRef.current(nextValue);
          }
        }
      },
      [editorTheme, placeholder, postToWebView]
    );

    // If the WebView editor doesn't boot (e.g. network blocked), fall back to plain text editor.
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (isPreview) return;
      if (forcePlainEditor) return;
      if (webViewReady) return;

      const timeout = setTimeout(() => {
        if (!webViewReady) {
          setForcePlainEditor(true);
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }, [forcePlainEditor, isPreview, webViewReady]);

    // When switching to preview, ensure the WebView editor re-initializes on next edit.
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (isPreview) {
        setWebViewReady(false);
      }
    }, [isPreview]);

    // Keep the WebView editor in sync when `value` changes externally (e.g., note refresh).
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (isPreview) return;
      if (forcePlainEditor) return;
      if (!webViewReady) return;

      if (value !== lastKnownEditorValueRef.current) {
        lastKnownEditorValueRef.current = value;
        postToWebView({ type: "setValue", value });
      }
    }, [forcePlainEditor, isPreview, postToWebView, value, webViewReady]);

    // Push theme/placeholder updates into the WebView editor.
    useEffect(() => {
      if (Platform.OS === "web") return;
      if (isPreview) return;
      if (forcePlainEditor) return;
      if (!webViewReady) return;

      postToWebView({ type: "setTheme", theme: editorTheme });
      postToWebView({ type: "setPlaceholder", placeholder });
    }, [editorTheme, forcePlainEditor, isPreview, placeholder, postToWebView, webViewReady]);

    const beginProgrammaticSelection = (nextSelection: { start: number; end: number }) => {
      pendingSelectionRef.current = nextSelection;
      suppressSelectionUpdatesRef.current += 1;
      setSelection(nextSelection);
    };

    const endProgrammaticSelection = () => {
      suppressSelectionUpdatesRef.current = Math.max(0, suppressSelectionUpdatesRef.current - 1);
      if (suppressSelectionUpdatesRef.current === 0) {
        pendingSelectionRef.current = null;
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
        onChangeText(newText);
        return;
      }

      const oldText = previousValueRef.current;
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');

      // Check if a newline was just added (text increased by exactly one line)
      if (newLines.length === oldLines.length + 1) {
        // Find which line was split by comparing line by line
        let splitLineIndex = -1;
        let splitPositionInLine = -1;

        for (let i = 0; i < oldLines.length; i++) {
          const oldLine = oldLines[i];
          const newLine = newLines[i];

          // If lines are different, the split happened here
          if (oldLine !== newLine) {
            splitLineIndex = i;
            // Find where in the line the split occurred
            // The new line should be a prefix of the old line (or vice versa if cursor was at start)
            if (newLine.length < oldLine.length) {
              // Split happened in the middle or end of oldLine
              splitPositionInLine = newLine.length;
            } else {
              // This shouldn't happen, but handle it
              splitPositionInLine = oldLine.length;
            }
            break;
          }
        }

        // If no difference found in existing lines, the split happened at the end of the last line
        if (splitLineIndex === -1) {
          splitLineIndex = oldLines.length - 1;
          const lastOldLine = oldLines[splitLineIndex] || '';
          splitPositionInLine = lastOldLine.length;
        }

        const oldLine = oldLines[splitLineIndex] || '';
        const newLineAfterSplit = newLines[splitLineIndex + 1] || '';

        // Calculate cursor position before the split
        // If splitPositionInLine is at the end of the line, cursor was at the end
        // Otherwise, we need to check if cursor was actually at the end
        const isAtEndOfLine = splitPositionInLine >= oldLine.length;

        // Only process if cursor was at the end of the line (typical use case)
        if (!isAtEndOfLine) {
          // Cursor was in the middle, let default behavior happen
          previousValueRef.current = newText;
          onChangeText(newText);
          return;
        }

        // Calculate cursor position before the split (end of the old line)
        let cursorBeforeSplit = 0;
        for (let i = 0; i < splitLineIndex; i++) {
          cursorBeforeSplit += oldLines[i].length + 1; // +1 for newline
        }
        cursorBeforeSplit += oldLine.length;

        // Check if we're in a list context at the cursor position before split
        const listInfo = getListInfo(oldText, cursorBeforeSplit);

        if (listInfo) {
          const { indent, nextMarker, currentLine } = listInfo;

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
      onChangeText(newText);
    };

    // Update previousValueRef when value changes externally
    useEffect(() => {
      if (!isProcessingListRef.current) {
        previousValueRef.current = value;
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset?: number) => {
        if (isPreview) return;

        // Web: CodeMirror editor
        if (Platform.OS === "web" && webCmViewRef.current) {
          const view = webCmViewRef.current;
          const sel = view.state.selection.main;
          const from = sel.from;
          const to = sel.to;
          const offset = cursorOffset ?? text.length;

          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + offset },
            scrollIntoView: true,
          });
          view.focus();
          webCmSelectionRef.current = { start: from + offset, end: from + offset };
          return;
        }

        // Native: WebView editor
        if (Platform.OS !== "web" && !forcePlainEditor && webViewReady) {
          postToWebView({ type: "insertText", text, cursorOffset });
          return;
        }

        // Fallback: plain RN TextInput editor
        if (!inputRef.current) return;

        const start = selection.start;
        const end = selection.end;
        const beforeText = value.substring(0, start);
        const afterText = value.substring(end);
        const newText = beforeText + text + afterText;
        const newCursorPosition = start + (cursorOffset ?? text.length);

        // Update state immediately - the controlled selection prop will handle cursor positioning
        beginProgrammaticSelection({ start: newCursorPosition, end: newCursorPosition });

        onChangeText(newText);

        // Ensure input maintains focus
        inputRef.current?.focus();

        // Set cursor position - use different methods for web vs native
        // Use requestAnimationFrame + timeout to ensure text has been updated
        const setCursorPosition = () => {
          if (Platform.OS === "web") {
            // For web, use DOM API directly
            const input = inputRef.current as any;
            if (input && input.setSelectionRange) {
              input.setSelectionRange(newCursorPosition, newCursorPosition);
            } else if (input && input.selectionStart !== undefined) {
              input.selectionStart = newCursorPosition;
              input.selectionEnd = newCursorPosition;
            }
          } else {
            // For native, use setNativeProps as fallback (controlled selection prop is primary)
            const input = inputRef.current as any;
            if (input && typeof input.setNativeProps === "function") {
              input.setNativeProps({
                selection: { start: newCursorPosition, end: newCursorPosition },
              });
            }
            inputRef.current?.focus();
          }
          endProgrammaticSelection();
        };

        // Use requestAnimationFrame + timeout to ensure text has been updated
        requestAnimationFrame(() => {
          setTimeout(setCursorPosition, Platform.OS === "android" ? 16 : 0);
        });
      },
      wrapSelection: (before: string, after: string, cursorOffset?: number) => {
        if (isPreview) return;

        // Web: CodeMirror editor
        if (Platform.OS === "web" && webCmViewRef.current) {
          const view = webCmViewRef.current;
          const sel = view.state.selection.main;
          const from = sel.from;
          const to = sel.to;
          const selectedText = view.state.doc.sliceString(from, to);

          if (selectedText.length > 0) {
            const insert = before + selectedText + after;
            view.dispatch({
              changes: { from, to, insert },
              selection: { anchor: from + insert.length },
              scrollIntoView: true,
            });
            view.focus();
            webCmSelectionRef.current = { start: from + insert.length, end: from + insert.length };
          } else {
            const insert = before + after;
            const offset = cursorOffset ?? before.length;
            view.dispatch({
              changes: { from, to, insert },
              selection: { anchor: from + offset },
              scrollIntoView: true,
            });
            view.focus();
            webCmSelectionRef.current = { start: from + offset, end: from + offset };
          }
          return;
        }

        // Native: WebView editor
        if (Platform.OS !== "web" && !forcePlainEditor && webViewReady) {
          postToWebView({ type: "wrapSelection", before, after, cursorOffset });
          return;
        }

        // Fallback: plain RN TextInput editor
        if (!inputRef.current) return;

        const start = selection.start;
        const end = selection.end;
        const selectedText = value.substring(start, end);

        // If there's selected text, wrap it; otherwise insert the formatting markers
        let newText: string;
        let newCursorPosition: number;

        if (selectedText.length > 0) {
          // Wrap selected text - place cursor at the end of the wrapped text
          newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
          newCursorPosition = start + before.length + selectedText.length + after.length;
        } else {
          // No selection, insert formatting markers with cursor positioned according to cursorOffset
          newText = value.substring(0, start) + before + after + value.substring(end);
          // cursorOffset should position cursor between before and after markers
          // e.g., for "**" + "**" with offset 2, cursor should be at start + 2 (after first "**")
          newCursorPosition = start + (cursorOffset ?? before.length);
        }

        // Update state immediately - the controlled selection prop will handle cursor positioning
        beginProgrammaticSelection({ start: newCursorPosition, end: newCursorPosition });

        onChangeText(newText);

        // Ensure input maintains focus
        inputRef.current?.focus();

        // Set cursor position - use different methods for web vs native
        // Use requestAnimationFrame + timeout to ensure text has been updated
        const setCursorPosition = () => {
          if (Platform.OS === "web") {
            // For web, use DOM API directly
            const input = inputRef.current as any;
            if (input && input.setSelectionRange) {
              input.setSelectionRange(newCursorPosition, newCursorPosition);
            } else if (input && input.selectionStart !== undefined) {
              input.selectionStart = newCursorPosition;
              input.selectionEnd = newCursorPosition;
            }
          } else {
            // For native, use setNativeProps as fallback (controlled selection prop is primary)
            const input = inputRef.current as any;
            if (input && typeof input.setNativeProps === "function") {
              input.setNativeProps({
                selection: { start: newCursorPosition, end: newCursorPosition },
              });
            }
            inputRef.current?.focus();
          }
          endProgrammaticSelection();
        };

        // Use requestAnimationFrame + timeout to ensure text has been updated
        requestAnimationFrame(() => {
          setTimeout(setCursorPosition, Platform.OS === "android" ? 16 : 0);
        });
      },
      focus: () => {
        if (Platform.OS === "web" && webCmViewRef.current) {
          webCmViewRef.current.focus();
          return;
        }
        if (Platform.OS !== "web" && !forcePlainEditor && webViewReady) {
          postToWebView({ type: "focus" });
          return;
        }
        inputRef.current?.focus();
      },
      getSelection: () => {
        if (Platform.OS === "web" && webCmViewRef.current) {
          return webCmSelectionRef.current;
        }
        if (Platform.OS !== "web" && !forcePlainEditor && webViewReady) {
          return webViewSelectionRef.current;
        }
        return selection;
      },
    }));

    const WebCodeMirror = useMemo(() => {
      if (Platform.OS !== "web") return null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require("@uiw/react-codemirror").default as any;
      } catch {
        return null;
      }
    }, []);

    const webCmExtensions = useMemo(() => {
      if (Platform.OS !== "web") return [];

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { keymap, EditorView } = require("@codemirror/view");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { markdown, markdownKeymap } = require("@codemirror/lang-markdown");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { languages } = require("@codemirror/language-data");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { defaultKeymap, history, historyKeymap, indentWithTab } = require("@codemirror/commands");

        const themeExt = EditorView.theme(
          {
            "&": {
              backgroundColor: editorTheme.background,
              color: editorTheme.foreground,
              height: "100%",
            },
            ".cm-editor": { height: "100%" },
            ".cm-scroller": {
              overflow: "auto",
              height: "100%",
              fontFamily: "monospace",
              backgroundColor: editorTheme.background,
            },
            ".cm-content": {
              paddingLeft: `${editorTheme.padX}px`,
              paddingRight: `${editorTheme.padX}px`,
              paddingTop: `${editorTheme.padTop}px`,
              paddingBottom: `${editorTheme.padBottom}px`,
              caretColor: editorTheme.caret,
              fontSize: `${editorTheme.fontSize}px`,
              lineHeight: `${editorTheme.lineHeight}px`,
            },
            ".cm-gutters": {
              backgroundColor: editorTheme.background,
              color: editorTheme.gutterForeground,
              border: "none",
            },
            ".cm-activeLine": { backgroundColor: editorTheme.lineHighlight },
            ".cm-selectionBackground, ::selection": { backgroundColor: editorTheme.selection + " !important" },
            ".cm-placeholder": { color: editorTheme.placeholder },
          },
          { dark: editorTheme.dark }
        );

        // NOTE: `markdownKeymap` includes Enter behavior (continue list markup) similar to Joplin.
        return [
          history(),
          markdown({ codeLanguages: languages }),
          keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
          themeExt,
        ];
      } catch {
        return [];
      }
    }, [editorTheme]);

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
        color: colors.primary,
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
      // `~~strike~~` (remark AST uses `del` for strikethrough; some configs use `s`)
      del: (node: any, children: any) => renderStrikeThrough(node, children),
      s: (node: any, children: any) => renderStrikeThrough(node, children),
      list_item: (node: any, children: any, parent: any, styles: any) => {
        // Extract text content from children, removing checkbox syntax for matching
        let childrenText = normalizeText(extractTextFromChildren(children));
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
          const restTextNormalized = normalizeText(restText);

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
                const restTextNormalized = normalizeText(info.restText);
                const textAfterNormalized = normalizeText(textAfterCheckbox);
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

    return (
      <View className={cn("flex-1", className)}>
        {/* Editor or Preview */}
        {isPreview ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: editorLayout.padX,
              paddingTop: editorLayout.previewPadTop,
              paddingBottom: editorLayout.previewPadBottom,
            }}
          >
            {value ? (
              <Markdown
                key={markdownKey}
                style={markdownStyles}
                rules={markdownRules}
                mergeStyle={false}
              >
                {value}
              </Markdown>
            ) : (
              <Text className="text-muted-foreground italic">{placeholder}</Text>
            )}
          </ScrollView>
        ) : (
          <>
            {Platform.OS === "web" && WebCodeMirror ? (
              <View style={{ flex: 1 }}>
                <WebCodeMirror
                  value={value}
                  height="100%"
                  basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    highlightActiveLineGutter: false,
                    highlightSpecialChars: true,
                    history: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    syntaxHighlighting: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: false,
                    rectangularSelection: true,
                    crosshairCursor: false,
                    highlightActiveLine: true,
                    highlightSelectionMatches: false,
                    closeBracketsKeymap: true,
                    defaultKeymap: true,
                    searchKeymap: true,
                    historyKeymap: true,
                    foldKeymap: false,
                    completionKeymap: false,
                    lintKeymap: false,
                  }}
                  extensions={webCmExtensions}
                  onCreateEditor={(view: any) => {
                    webCmViewRef.current = view;
                    const sel = view.state.selection.main;
                    webCmSelectionRef.current = { start: sel.from, end: sel.to };
                  }}
                  onUpdate={(vu: any) => {
                    const sel = vu.state.selection.main;
                    webCmSelectionRef.current = { start: sel.from, end: sel.to };
                  }}
                  onChange={(nextValue: string) => {
                    lastKnownEditorValueRef.current = nextValue;
                    if (nextValue !== latestValueRef.current) {
                      onChangeTextRef.current(nextValue);
                    }
                  }}
                />
              </View>
            ) : Platform.OS !== "web" && !forcePlainEditor ? (
              <WebView
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={webViewRef as any}
                originWhitelist={["*"]}
                source={{ html: webViewHtml }}
                onMessage={handleWebViewMessage}
                onError={() => setForcePlainEditor(true)}
                javaScriptEnabled
                domStorageEnabled
                keyboardDisplayRequiresUserAction={false}
                setSupportMultipleWindows={false}
                style={{ flex: 1, backgroundColor: editorTheme.background }}
              />
            ) : (
              <Input
                ref={inputRef}
                className="flex-1 border-0 shadow-none bg-transparent text-base leading-6 font-mono px-8"
                placeholder={placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={value}
                onChangeText={handleTextChange}
                selection={selection}
                onSelectionChange={(e) => {
                  const next = e.nativeEvent.selection;
                  const pending = pendingSelectionRef.current;

                  // During programmatic updates, ignore transient selection events (often {0,0} on Android)
                  if (isProcessingListRef.current || suppressSelectionUpdatesRef.current > 0) {
                    if (!pending || pending.start !== next.start || pending.end !== next.end) {
                      return;
                    }
                  }

                  setSelection({ start: next.start, end: next.end });
                }}
                multiline
                blurOnSubmit={false}
                textAlignVertical="top"
                style={{
                  paddingHorizontal: editorLayout.padX,
                  paddingTop: editorLayout.padTop,
                  paddingBottom: editorLayout.padBottom,
                  fontFamily: "monospace",
                  fontSize: editorLayout.fontSize,
                  lineHeight: editorLayout.lineHeight,
                  flex: 1,
                }}
              />
            )}
          </>
        )}
      </View>
    );
  }
);
