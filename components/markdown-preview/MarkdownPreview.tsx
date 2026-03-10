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


const CHECK_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

export interface MarkdownPreviewProps {
  /** Raw markdown string (same as editor value). Will be linkified and converted to HTML via remark/rehype. */
  content: string;
  contentContainerStyle?: object;
  className?: string;
  /** Placeholder when content is empty */
  placeholder?: string;
  /** When a checkbox is toggled in the preview, called with a functional updater or new string so the parent can update content atomically. */
  onToggleCheckbox?: (updater: string | ((prev: string) => string)) => void;
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
  const skipNextHtmlGenRef = useRef(false);
  const generationRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNotifiedFirstHtmlRef = useRef(false);

  useEffect(() => {
    if (skipNextHtmlGenRef.current) {
      skipNextHtmlGenRef.current = false;
      return;
    }

    const gen = ++generationRef.current;
    
    // ... rest of the existing useEffect logic ...
    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!content || !content.trim()) {
      setHtml("");
      if (!hasNotifiedFirstHtmlRef.current) {
        hasNotifiedFirstHtmlRef.current = true;
        if (typeof onFirstHtmlRendered === "function") {
          onFirstHtmlRendered();
        }
      }
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      const linked = linkifyMarkdown(content);
      markdownToHtml(linked)
        .then((result) => {
          if (generationRef.current === gen) {
            setHtml(result);
            if (!hasNotifiedFirstHtmlRef.current && result.trim()) {
              hasNotifiedFirstHtmlRef.current = true;
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

  const handleCheckboxToggle = (lineIndex: number) => {
    if (!onToggleCheckbox || lineIndex < 0) return;
    
    // Optimistic HTML Update for instant feedback
    setHtml(prevHtml => {
      if (!prevHtml) return prevHtml;
      const escapedIdx = String(lineIndex);
      
      // 1. Try to find and patch a <button> (Custom DOM Checkbox)
      // Matches: <button ... data-line-index="N" ... > ... </button>
      const btnTagRegex = new RegExp(`(<button[^>]*data-line-index="${escapedIdx}"[^>]*>)([\\s\\S]*?)(</button>)`, 'g');
      if (btnTagRegex.test(prevHtml)) {
        return prevHtml.replace(btnTagRegex, (match, openTag, content, closeTag) => {
          const isChecked = openTag.includes('aria-checked="true"');
          const newCheckedValue = !isChecked;
          
          // Toggle aria-checked
          let newOpenTag = openTag.replace(/aria-checked="(true|false)"/, `aria-checked="${newCheckedValue}"`);
          
          // Toggle "checked" class
          if (newCheckedValue) {
            if (!newOpenTag.includes('class="')) {
              newOpenTag = newOpenTag.replace('>', ' class="checked">');
            } else if (!newOpenTag.includes('checked')) {
              newOpenTag = newOpenTag.replace(/class="([^"]*)"/, 'class="$1 checked"');
            }
          } else {
            newOpenTag = newOpenTag.replace(/\s?checked\s?/, ' ');
          }
          
          // Toggle SVG content
          const newContent = newCheckedValue ? CHECK_ICON_SVG : '';
          
          return `${newOpenTag}${newContent}${closeTag}`;
        });
      }
      
      // 2. Fallback to 1. Try to find and patch an <input> (Standard GFM Checkbox)
      // Matches: <input ... data-line-index="N" ... >
      const inputTagRegex = new RegExp(`(<input[^>]*data-line-index="${escapedIdx}"[^>]*>)`, 'g');
      return prevHtml.replace(inputTagRegex, (match, tag) => {
        if (tag.includes('checked')) {
          return tag.replace(/\s?checked(=["']checked["'])?\s?/, ' ');
        } else {
          return tag.replace('>', ' checked>');
        }
      });
    });

    // Atomic Functional Update: Bypass state staleness by passing a setter function.
    skipNextHtmlGenRef.current = true;
    onToggleCheckbox((prev) => toggleCheckboxInMarkdown(prev, lineIndex));
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
