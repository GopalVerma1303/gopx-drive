"use client";

import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { getMarkdownThemeFromPalette, getPreviewCss } from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";

interface MarkdownPreviewWebProps {
  html: string;
  contentContainerStyle?: object;
  className?: string;
}

const CHECKBOX_WRAPPER_CLASS = "markdown-preview-checkbox-wrapper";
const TASK_LIST_ITEM_CLASS = "task-list-item";
const CHECKBOX_CLASS = "md-preview-checkbox";
const CHECKBOX_CHECKED_CLASS = "checked";

/** Check icon as inline SVG string (no React, works in any DOM context). */
const CHECK_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

/**
 * Replace native checkbox inputs with pure-DOM custom checkboxes that toggle completed/not completed on click.
 */
function replaceCheckboxesWithDom(container: HTMLDivElement) {
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  inputs.forEach((input) => {
    let checked = input.hasAttribute("checked");
    const parentLi = input.closest("li");
    if (parentLi && !parentLi.classList.contains(TASK_LIST_ITEM_CLASS)) {
      parentLi.classList.add(TASK_LIST_ITEM_CLASS);
    }
    const wrapper = document.createElement("span");
    wrapper.className = CHECKBOX_WRAPPER_CLASS;

    const box = document.createElement("button");
    box.type = "button";
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(checked));
    box.setAttribute("aria-label", "Task list checkbox");
    box.className = checked ? `${CHECKBOX_CLASS} ${CHECKBOX_CHECKED_CLASS}` : CHECKBOX_CLASS;
    box.innerHTML = checked ? CHECK_ICON_SVG : "";

    const updateVisual = () => {
      box.setAttribute("aria-checked", String(checked));
      if (checked) {
        box.classList.add(CHECKBOX_CHECKED_CLASS);
        box.innerHTML = CHECK_ICON_SVG;
      } else {
        box.classList.remove(CHECKBOX_CHECKED_CLASS);
        box.innerHTML = "";
      }
    };

    box.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      checked = !checked;
      updateVisual();
    });

    wrapper.appendChild(box);
    input.parentNode?.replaceChild(wrapper, input);
  });
}

export function MarkdownPreviewWeb({
  html,
  contentContainerStyle,
  className,
}: MarkdownPreviewWebProps) {
  const { colors, isDark } = useThemeColors();
  const theme = getMarkdownThemeFromPalette(colors, isDark);
  const css = getPreviewCss(theme);
  const containerRef = useRef<HTMLDivElement>(null);

  // Replace native checkboxes whenever container content changes (avoids race where DOM isn't ready yet)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    let rafId: number | null = null;
    const run = () => {
      rafId = null;
      const el = containerRef.current;
      if (el) replaceCheckboxesWithDom(el);
    };
    const scheduleRun = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(run);
    };

    // Run once after mount/update (double rAF so React has committed innerHTML)
    requestAnimationFrame(() => {
      requestAnimationFrame(scheduleRun);
    });
    const t1 = setTimeout(scheduleRun, 50);
    const t2 = setTimeout(scheduleRun, 200);

    // Observe future DOM changes (e.g. late innerHTML, or container reused) so checkboxes are always replaced
    const observer = new MutationObserver(scheduleRun);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
    };
  }, [html]);

  if (!html) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentBase, contentContainerStyle]}
      >
        <View className={className} />
      </ScrollView>
    );
  }

  /* contentContainerStyle has no horizontal padding so scrollbar sits at edge; padding is on .markdown-preview in CSS */
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.contentBase, contentContainerStyle]}
      removeClippedSubviews={false}
      nestedScrollEnabled
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        ref={containerRef}
        className={`markdown-preview ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentBase: {
    flexGrow: 1,
    minHeight: "100%",
  },
});
