"use client";

import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { linkifyMarkdown } from "@/components/markdown-editor/utils/text-helpers";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { MarkdownPreviewWeb } from "./MarkdownPreviewWeb";
import { MarkdownPreviewWebView } from "./MarkdownPreviewWebView";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MarkdownPreviewProps {
  /** Raw markdown string (same as editor value). Will be linkified and converted to HTML via remark/rehype. */
  content: string;
  contentContainerStyle?: object;
  className?: string;
  /** Placeholder when content is empty */
  placeholder?: string;
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
}: MarkdownPreviewProps) {
  const [html, setHtml] = useState("");
  const generationRef = useRef(0);

  useEffect(() => {
    const gen = ++generationRef.current;
    if (!content || !content.trim()) {
      setHtml("");
      return;
    }
    const linked = linkifyMarkdown(content);
    markdownToHtml(linked)
      .then((result) => {
        if (generationRef.current === gen) {
          setHtml(result);
        }
      })
      .catch(() => {
        if (generationRef.current === gen) {
          setHtml(`<p class="preview-placeholder">${escapeHtml(content.slice(0, 500))}</p>`);
        }
      });
  }, [content]);

  const isEmpty = !content || !content.trim();
  const placeholderHtml = `<p class="preview-placeholder">${escapeHtml(placeholder)}</p>`;
  const displayHtml = isEmpty
    ? placeholderHtml
    : html || "<p class=\"preview-placeholder\">Loading…</p>";

  if (Platform.OS === "web") {
    return (
      <MarkdownPreviewWeb
        html={displayHtml}
        contentContainerStyle={contentContainerStyle}
        className={className}
      />
    );
  }

  return (
    <MarkdownPreviewWebView
      html={displayHtml}
      contentContainerStyle={contentContainerStyle}
    />
  );
}
