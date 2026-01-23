import { MarkdownEditor } from "@/components/markdown-editor";
import { useThemeColors } from "@/lib/use-theme-colors";
import React, { forwardRef, useMemo, useRef } from "react";
import type { RichTextEditorProps, RichTextEditorRef } from "./rich-text-editor.types";

// IMPORTANT:
// Metro (Expo) can sometimes resolve the `node` export condition for Lexical's ESM builds,
// which use top-level await (e.g. `*.node.mjs`) and crash with "await is not defined".
// Using `require()` forces the CommonJS `require` export condition, which avoids that path.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ContentEditable } = require("@lexical/react/LexicalContentEditable") as typeof import("@lexical/react/LexicalContentEditable");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LexicalComposer } = require("@lexical/react/LexicalComposer") as typeof import("@lexical/react/LexicalComposer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LexicalErrorBoundary } = require("@lexical/react/LexicalErrorBoundary") as typeof import("@lexical/react/LexicalErrorBoundary");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OnChangePlugin } = require("@lexical/react/LexicalOnChangePlugin") as typeof import("@lexical/react/LexicalOnChangePlugin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useLexicalComposerContext } = require("@lexical/react/LexicalComposerContext") as typeof import("@lexical/react/LexicalComposerContext");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RichTextPlugin } = require("@lexical/react/LexicalRichTextPlugin") as typeof import("@lexical/react/LexicalRichTextPlugin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HistoryPlugin } = require("@lexical/react/LexicalHistoryPlugin") as typeof import("@lexical/react/LexicalHistoryPlugin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MarkdownShortcutPlugin } = require("@lexical/react/LexicalMarkdownShortcutPlugin") as typeof import("@lexical/react/LexicalMarkdownShortcutPlugin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LinkPlugin } = require("@lexical/react/LexicalLinkPlugin") as typeof import("@lexical/react/LexicalLinkPlugin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ListPlugin } = require("@lexical/react/LexicalListPlugin") as typeof import("@lexical/react/LexicalListPlugin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CheckListPlugin } = require("@lexical/react/LexicalCheckListPlugin") as typeof import("@lexical/react/LexicalCheckListPlugin");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HeadingNode, QuoteNode } = require("@lexical/rich-text") as typeof import("@lexical/rich-text");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LinkNode, TOGGLE_LINK_COMMAND } = require("@lexical/link") as typeof import("@lexical/link");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  ListItemNode,
  ListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} = require("@lexical/list") as typeof import("@lexical/list");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CodeNode, INSERT_CODE_BLOCK_COMMAND } = require("@lexical/code") as typeof import("@lexical/code");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } = require("@lexical/markdown") as typeof import("@lexical/markdown");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { $getRoot, FORMAT_ELEMENT_COMMAND, FORMAT_TEXT_COMMAND, INSERT_TEXT_COMMAND } = require("lexical") as typeof import("lexical");

function Placeholder({ text }: { text: string }) {
  return <div className="lexicalPlaceholder">{text}</div>;
}

function ImperativeHandlePlugin({
  editorRef,
}: {
  editorRef: React.ForwardedRef<RichTextEditorRef>;
}) {
  const [editor] = useLexicalComposerContext();

  React.useImperativeHandle(
    editorRef,
    () => ({
      insertText: (text: string) => {
        // Map existing MarkdownToolbar inserts to Lexical actions.
        if (text === "#" || text === "# ") {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "h1");
          return;
        }
        if (text === "> ") {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "quote");
          return;
        }
        if (text === "- ") {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          return;
        }
        if (text === "1. ") {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          return;
        }
        if (text === "- [ ] ") {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
          return;
        }
        if (text === "```\n\n```") {
          editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, undefined);
          return;
        }
        if (text === "[]()") {
          const url = window.prompt("Link URL");
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, url && url.trim().length > 0 ? url.trim() : null);
          return;
        }

        // Unsupported by Lexical in this app (for now): images, tables, etc.
        editor.dispatchCommand(INSERT_TEXT_COMMAND, text);
      },
      wrapSelection: (before: string, after: string) => {
        // Map existing MarkdownToolbar wraps to Lexical formats.
        if (before === "**" && after === "**") {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          return;
        }
        if (before === "*" && after === "*") {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          return;
        }
        if (before === "~~" && after === "~~") {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
          return;
        }
        if (before === "`" && after === "`") {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
          return;
        }

        editor.dispatchCommand(INSERT_TEXT_COMMAND, `${before}${after}`);
      },
      focus: () => {
        editor.focus();
      },
      getSelection: () => ({ start: 0, end: 0 }),
    }),
    [editor]
  );

  return null;
}

function MarkdownSyncPlugin({
  value,
  lastEmittedMarkdownRef,
}: {
  value: string;
  lastEmittedMarkdownRef: React.MutableRefObject<string>;
}) {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    // Avoid fighting the local editor: if the parent value is exactly what we last emitted,
    // we don't need to re-import it.
    if (value === lastEmittedMarkdownRef.current) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();
      $convertFromMarkdownString(value, TRANSFORMERS);
    });
  }, [editor, value, lastEmittedMarkdownRef]);

  return null;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor({ value, onChangeText, placeholder = "Start writing...", className, isPreview = false }, ref) {
    const { colors, isDark } = useThemeColors();
    const lastEmittedMarkdownRef = useRef<string>(value);
    const pendingRafRef = useRef<number | null>(null);

    const css = useMemo(() => {
      const caret = colors.foreground;
      const placeholderColor = colors.mutedForeground;
      const selectionBg = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
      return `
        .lexicalRoot {
          position: relative;
          flex: 1;
          min-height: 100%;
          background: transparent;
        }
        .lexicalContentEditable {
          outline: none;
          min-height: 100%;
          padding: 30px 32px 65px;
          font-size: 16px;
          line-height: 24px;
          color: ${colors.foreground};
          caret-color: ${caret};
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          white-space: pre-wrap;
          word-break: break-word;
        }
        .lexicalPlaceholder {
          position: absolute;
          top: 30px;
          left: 32px;
          right: 32px;
          color: ${placeholderColor};
          pointer-events: none;
          user-select: none;
        }
        .lexicalContentEditable ::selection {
          background: ${selectionBg};
        }
      `;
    }, [colors, isDark]);

    const initialConfig = useMemo(() => {
      return {
        namespace: "gopx-drive-lexical-markdown",
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
        editorState: () => {
          const root = $getRoot();
          root.clear();
          $convertFromMarkdownString(value, TRANSFORMERS);
        },
        onError(error: Error) {
          // Keep this noisy in dev, quiet in prod.
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        },
      };
    }, []);

    if (isPreview) {
      // Keep existing preview renderer exactly as-is (markdown + custom checkbox/code rules).
      return (
        <MarkdownEditor
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          className={className}
          isPreview={true}
        />
      );
    }

    return (
      <>
        <style>{css}</style>
        <LexicalComposer initialConfig={initialConfig}>
          <ImperativeHandlePlugin editorRef={ref} />
          <MarkdownSyncPlugin value={value} lastEmittedMarkdownRef={lastEmittedMarkdownRef} />
          <div className="lexicalRoot">
            <RichTextPlugin
              contentEditable={<ContentEditable className="lexicalContentEditable" />}
              placeholder={<Placeholder text={placeholder} />}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <OnChangePlugin
            ignoreSelectionChange
            onChange={(editorState) => {
              // Export markdown on change (throttled to next animation frame).
              if (pendingRafRef.current != null) {
                cancelAnimationFrame(pendingRafRef.current);
              }
              pendingRafRef.current = requestAnimationFrame(() => {
                pendingRafRef.current = null;
                editorState.read(() => {
                  const markdown = $convertToMarkdownString(TRANSFORMERS);
                  if (markdown === lastEmittedMarkdownRef.current) return;
                  lastEmittedMarkdownRef.current = markdown;
                  onChangeText(markdown);
                });
              });
            }}
          />
        </LexicalComposer>
      </>
    );
  }
);

