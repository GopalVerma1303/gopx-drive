"use client";

import { detectCheckboxInLine, toggleCheckboxInMarkdown } from "@/components/markdown-toolbar";
import { linkifyMarkdown } from "@/components/markdown-editor/utils/text-helpers";
import { markdownToHtml } from "@/lib/markdown-to-html";
import React, { useMemo, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { MarkdownPreviewWeb } from "./MarkdownPreviewWeb";
import { MarkdownPreviewWebView } from "./MarkdownPreviewWebView";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Line indices in content that are task list items (have - [ ] or - [x] etc.). */
function getTaskListLineIndices(content: string): number[] {
  const lines = content.split("\n");
  const indices: number[] = [];
  lines.forEach((line, i) => {
    const info = detectCheckboxInLine(line);
    if (info?.hasCheckbox) indices.push(i);
  });
  return indices;
}

export interface MarkdownPreviewProps {
  /** Raw markdown string (same as editor value). Will be linkified and converted to HTML via remark/rehype. */
  content: string;
  contentContainerStyle?: object;
  className?: string;
  /** Placeholder when content is empty */
  placeholder?: string;
  /** When a checkbox is toggled in the preview, called with the new markdown so the parent can update content. */
  onToggleCheckbox?: (newMarkdown: string) => void;
  /** Called once when non-empty HTML has been rendered for the first time. Useful for outer screens to hide a loading state. */
  onFirstHtmlRendered?: () => void;
  searchQuery?: string;
  currentMatchIndex?: number;
  onSearchMatchCount?: (count: number) => void;
}

/**
 * Renders markdown as HTML using remark/rehype. On web renders in a div; on native in a WebView.
 * Receives content (markdown) from parent and converts to HTML. Keeps previous HTML until new one is ready.
 */
export function MarkdownPreview({
  content,
  contentContainerStyle,
  className,
  placeholder = "Nothing to preview.",
  onToggleCheckbox,
  onFirstHtmlRendered,
  searchQuery,
  currentMatchIndex,
  onSearchMatchCount,
}: MarkdownPreviewProps) {
  const [html, setHtml] = useState("");
  const generationRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNotifiedFirstHtmlRef = useRef(false);
  const taskListLineIndices = useMemo(() => getTaskListLineIndices(content), [content]);

  useEffect(() => {
    const gen = ++generationRef.current;

    // Cancel any in-flight debounce when content changes
    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!content || !content.trim()) {
      setHtml("");
      // For empty content, consider preview "ready" so outer loaders can hide.
      if (!hasNotifiedFirstHtmlRef.current) {
        hasNotifiedFirstHtmlRef.current = true;
        if (typeof onFirstHtmlRendered === "function") {
          onFirstHtmlRendered();
        }
      }
      return;
    }

    // Debounce markdown → HTML conversion so typing stays snappy and
    // preview work doesn't run on every single keystroke.
    debounceTimerRef.current = setTimeout(() => {
      const linked = linkifyMarkdown(content);
      markdownToHtml(linked)
        .then((result) => {
          if (generationRef.current === gen) {
            setHtml(result);
            if (!hasNotifiedFirstHtmlRef.current && result.trim()) {
              hasNotifiedFirstHtmlRef.current = true;
              // Notify parent that initial HTML is ready (best-effort)
              (typeof onFirstHtmlRendered === "function") &&
                onFirstHtmlRendered();
            }
          }
        })
        .catch(() => {
          if (generationRef.current === gen) {
            const fallback = `<p class="preview-placeholder">${escapeHtml(
              content.slice(0, 500)
            )}</p>`;
            setHtml(fallback);
            if (!hasNotifiedFirstHtmlRef.current && content.trim()) {
              hasNotifiedFirstHtmlRef.current = true;
              (typeof onFirstHtmlRendered === "function") &&
                onFirstHtmlRendered();
            }
          }
        });
    }, 200);

    return () => {
      if (debounceTimerRef.current != null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [content, onFirstHtmlRendered]);

  const isEmpty = !content || !content.trim();
  const placeholderHtml = `<p class="preview-placeholder">${escapeHtml(placeholder)}</p>`;
  const displayHtml = isEmpty
    ? placeholderHtml
    : html || "";

  const handleCheckboxToggle = (taskIndex: number) => {
    if (!onToggleCheckbox || taskIndex < 0 || taskIndex >= taskListLineIndices.length) return;
    const lineIndex = taskListLineIndices[taskIndex];
    const newMarkdown = toggleCheckboxInMarkdown(content, lineIndex);
    onToggleCheckbox(newMarkdown);
  };

  if (Platform.OS === "web") {
    return (
      <MarkdownPreviewWeb
        html={displayHtml}
        onToggleCheckbox={onToggleCheckbox ? handleCheckboxToggle : undefined}
        contentContainerStyle={contentContainerStyle}
        className={className}
        searchQuery={searchQuery}
        currentMatchIndex={currentMatchIndex}
        onSearchMatchCount={onSearchMatchCount}
      />
    );
  }

  return (
    <MarkdownPreviewWebView
      html={displayHtml}
      contentContainerStyle={contentContainerStyle}
      onCheckboxToggle={onToggleCheckbox ? handleCheckboxToggle : undefined}
      searchQuery={searchQuery}
      currentMatchIndex={currentMatchIndex}
      onSearchMatchCount={onSearchMatchCount}
    />
  );
}
