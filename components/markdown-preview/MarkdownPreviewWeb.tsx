"use client";

import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { getMarkdownThemeFromPalette, getPreviewCss } from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";

interface MarkdownPreviewWebProps {
  html: string;
  /** Called with task index (0-based DOM order) when a checkbox is toggled. Parent should update markdown. */
  onToggleCheckbox?: (taskIndex: number) => void;
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

/** Copy icon (clipboard outline). */
const COPY_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

const CODE_COPY_BTN_CLASS = "code-copy-btn";
const COPIED_DURATION_MS = 2000;

const CODE_BLOCK_SCROLL_CLASS = "code-block-scroll";
const TABLE_SCROLL_CLASS = "markdown-table-scroll";

/**
 * Add copy button to each code block (pre). Wrap code in a scrollable div so the button (sibling) stays fixed and does not scroll with the code.
 */
function addCodeCopyButtons(container: HTMLDivElement) {
  const pres = container.querySelectorAll("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(`.${CODE_COPY_BTN_CLASS}`)) return;
    const codeEl = pre.querySelector("code");
    const text = (codeEl?.innerText ?? (pre as HTMLElement).innerText ?? "").trim();

    // Wrap all existing children (the code) in a scrollable div so only the code scrolls, not the button
    const scrollWrap = document.createElement("div");
    scrollWrap.className = CODE_BLOCK_SCROLL_CLASS;
    while (pre.firstChild) {
      scrollWrap.appendChild(pre.firstChild);
    }
    pre.appendChild(scrollWrap);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = CODE_COPY_BTN_CLASS;
    btn.setAttribute("aria-label", "Copy code");
    btn.innerHTML = COPY_ICON_SVG;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("copied");
        btn.innerHTML = CHECK_ICON_SVG;
        const t = setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = COPY_ICON_SVG;
        }, COPIED_DURATION_MS);
        (btn as unknown as { _copyTimeout?: number })._copyTimeout = t;
      } catch {
        // ignore
      }
    });
    pre.insertBefore(btn, scrollWrap);
  });
}

/**
 * Wrap tables that have more than 3 columns in a horizontal scroll container
 * so they don't overflow the viewport. The wrapper uses the TABLE_SCROLL_CLASS
 * which is styled in markdown-theme.ts.
 */
function wrapWideTables(container: HTMLDivElement) {
  const tables = container.querySelectorAll<HTMLTableElement>("table");
  tables.forEach((table) => {
    if (table.closest(`.${TABLE_SCROLL_CLASS}`)) return;
    const headerRow = table.tHead?.rows[0] ?? table.rows[0];
    if (!headerRow) return;
    const columnCount = headerRow.cells.length;
    if (columnCount <= 3) return;
    const wrapper = document.createElement("div");
    wrapper.className = TABLE_SCROLL_CLASS;
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

const TASK_INDEX_ATTR = "data-task-index";

/**
 * Replace native checkbox inputs with pure-DOM custom checkboxes. On click toggles visual state and calls onToggleCheckbox(taskIndex) so parent can update markdown.
 */
function replaceCheckboxesWithDom(
  container: HTMLDivElement,
  onToggleCheckbox?: (taskIndex: number) => void
) {
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  inputs.forEach((input, taskIndex) => {
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
    box.setAttribute(TASK_INDEX_ATTR, String(taskIndex));
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
      onToggleCheckbox?.(taskIndex);
    });

    wrapper.appendChild(box);
    input.parentNode?.replaceChild(wrapper, input);
  });
}

export function MarkdownPreviewWeb({
  html,
  onToggleCheckbox,
  contentContainerStyle,
  className,
}: MarkdownPreviewWebProps) {
  const { colors, isDark } = useThemeColors();
  const theme = getMarkdownThemeFromPalette(colors, isDark);
  const css = getPreviewCss(theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const onToggleRef = useRef(onToggleCheckbox);
  onToggleRef.current = onToggleCheckbox;

  // Replace native checkboxes whenever container content changes.
  // On web we can do this immediately after innerHTML is applied – React commits
  // the HTML before running effects – so we don't need delayed rAF/timeout logic.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    replaceCheckboxesWithDom(container, (taskIndex) => onToggleRef.current?.(taskIndex));
    addCodeCopyButtons(container);
    wrapWideTables(container);
  }, [html, onToggleCheckbox]);

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
