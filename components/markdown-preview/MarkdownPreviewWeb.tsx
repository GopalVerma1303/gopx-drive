"use client";

import { getMarkdownThemeFromPalette, getPreviewCss } from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

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

/** Reset/refresh icon for mermaid zoom reset (Lucide-style rotate-cw). */
const RESET_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg>';

/** Zoom in icon (Lucide zoom-in). */
const ZOOM_IN_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

/** Zoom out icon (Lucide zoom-out). */
const ZOOM_OUT_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

/** Arrow icons (Lucide arrows). */
const ARROW_UP_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
const ARROW_DOWN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
const ARROW_LEFT_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
const ARROW_RIGHT_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

const CODE_COPY_BTN_CLASS = "code-copy-btn";
const COPIED_DURATION_MS = 2000;

const CODE_BLOCK_SCROLL_CLASS = "code-block-scroll";
const TABLE_SCROLL_CLASS = "markdown-table-scroll";
const IMAGE_WITH_CAPTION_CLASS = "image-with-caption";
const MERMAID_BLOCK_CLASS = "mermaid-block";
const MERMAID_CONTROLS_CLASS = "mermaid-controls";

/**
 * Best-effort clipboard copy that works on more mobile browsers.
 * Tries navigator.clipboard; falls back to a hidden textarea + execCommand("copy").
 */
async function copyTextToClipboard(text: string) {
  if (!text) return;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to textarea path
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  } catch {
    // give up; no supported clipboard path
  }
}

function addCodeCopyButtons(container: HTMLDivElement) {
  const pres = container.querySelectorAll("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(`.${CODE_COPY_BTN_CLASS}`)) return;
    // Ensure code is wrapped in an inner scroll container so the copy button
    // can stay fixed while only the code scrolls horizontally.
    let scrollWrapper = pre.querySelector<HTMLElement>(`.${CODE_BLOCK_SCROLL_CLASS}`);
    if (!scrollWrapper) {
      scrollWrapper = document.createElement("div");
      scrollWrapper.className = CODE_BLOCK_SCROLL_CLASS;
      // Move all existing children (code, whitespace, etc.) into the wrapper.
      while (pre.firstChild) {
        scrollWrapper.appendChild(pre.firstChild);
      }
      pre.appendChild(scrollWrapper);
    }

    const codeEl = scrollWrapper.querySelector("code") ?? pre.querySelector("code");
    const text = (codeEl?.innerText ?? (pre as HTMLElement).innerText ?? "").trim();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = CODE_COPY_BTN_CLASS;
    btn.setAttribute("aria-label", "Copy code");
    btn.innerHTML = COPY_ICON_SVG;
    btn.addEventListener("click", async () => {
      await copyTextToClipboard(text);
      btn.classList.add("copied");
      btn.innerHTML = CHECK_ICON_SVG;
      const t = setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = COPY_ICON_SVG;
      }, COPIED_DURATION_MS);
      (btn as unknown as { _copyTimeout?: number })._copyTimeout = t;
    });
    // Insert the button as a sibling before the scroll wrapper so it does not scroll with the code.
    pre.insertBefore(btn, scrollWrapper);
  });
}

/**
 * Wrap all tables in a horizontal scroll container so that overflowing content
 * (wide columns, long words, code, etc.) can scroll horizontally on small screens.
 * The wrapper uses the TABLE_SCROLL_CLASS which is styled in markdown-theme.ts.
 */
function wrapWideTables(container: HTMLDivElement) {
  const tables = container.querySelectorAll<HTMLTableElement>("table");
  tables.forEach((table) => {
    if (table.closest(`.${TABLE_SCROLL_CLASS}`)) return;
    const wrapper = document.createElement("div");
    wrapper.className = TABLE_SCROLL_CLASS;
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

/**
 * Wrap images that have alt text in a <figure> with a <figcaption> so we can
 * show the alt text as a caption under the image. Images without alt text stay
 * as-is with no caption.
 */
function wrapImagesWithCaptions(container: HTMLDivElement) {
  const images = container.querySelectorAll<HTMLImageElement>("img[alt]");
  images.forEach((img) => {
    const alt = (img.getAttribute("alt") || "").trim();
    if (!alt) return;
    // Avoid double-wrapping
    if (img.parentElement && img.parentElement.tagName.toLowerCase() === "figure") {
      return;
    }
    const figure = document.createElement("figure");
    figure.className = IMAGE_WITH_CAPTION_CLASS;
    const caption = document.createElement("figcaption");
    caption.textContent = alt;
    img.parentNode?.insertBefore(figure, img);
    figure.appendChild(img);
    figure.appendChild(caption);
  });
}

function enhanceMermaidBlocks(container: HTMLDivElement) {
  const mermaidNodes = container.querySelectorAll<HTMLElement>(".mermaid");
  mermaidNodes.forEach((node) => {
    if (node.parentElement && node.parentElement.classList.contains(MERMAID_BLOCK_CLASS)) {
      return;
    }

    const source = node.getAttribute("data-mermaid-source") ?? "";

    const wrapper = document.createElement("div");
    wrapper.className = MERMAID_BLOCK_CLASS;

    const controls = document.createElement("div");
    controls.className = MERMAID_CONTROLS_CLASS;

    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    const applyScale = () => {
      node.style.transformOrigin = "center center";
      node.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    };

    const makeButton = (opts: {
      html: string;
      ariaLabel: string;
      onClick: () => void;
      extraClassName?: string;
      gridArea?: string;
    }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = opts.html;
      btn.setAttribute("aria-label", opts.ariaLabel);
      if (opts.extraClassName) {
        btn.className = opts.extraClassName;
      }
      if (opts.gridArea) {
        btn.style.gridArea = opts.gridArea;
      }
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        opts.onClick();
      });
      return btn;
    };

    const PAN_STEP = 40;

    const upBtn = makeButton({
      html: ARROW_UP_SVG,
      ariaLabel: "Pan up",
      gridArea: "up",
      onClick: () => {
        offsetY += PAN_STEP;
        applyScale();
      },
    });

    const downBtn = makeButton({
      html: ARROW_DOWN_SVG,
      ariaLabel: "Pan down",
      gridArea: "down",
      onClick: () => {
        offsetY -= PAN_STEP;
        applyScale();
      },
    });

    const leftBtn = makeButton({
      html: ARROW_LEFT_SVG,
      ariaLabel: "Pan left",
      gridArea: "left",
      onClick: () => {
        offsetX += PAN_STEP;
        applyScale();
      },
    });

    const rightBtn = makeButton({
      html: ARROW_RIGHT_SVG,
      ariaLabel: "Pan right",
      gridArea: "right",
      onClick: () => {
        offsetX -= PAN_STEP;
        applyScale();
      },
    });

    const zoomOutBtn = makeButton({
      html: ZOOM_OUT_ICON_SVG,
      ariaLabel: "Zoom out",
      gridArea: "zoomOut",
      onClick: () => {
        scale = Math.max(scale - 0.25, 0.5);
        applyScale();
      },
    });

    const zoomInBtn = makeButton({
      html: ZOOM_IN_ICON_SVG,
      ariaLabel: "Zoom in",
      gridArea: "zoomIn",
      onClick: () => {
        scale = Math.min(scale + 0.25, 3);
        applyScale();
      },
    });

    const resetBtn = makeButton({
      html: RESET_ICON_SVG,
      ariaLabel: "Reset zoom",
      gridArea: "reset",
      onClick: () => {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        applyScale();
      },
    });

    const copyBtn = makeButton({
      html: COPY_ICON_SVG,
      ariaLabel: "Copy mermaid source",
      extraClassName: "mermaid-copy-btn",
      onClick: async () => {
        if (!source) return;
        await copyTextToClipboard(source);
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = CHECK_ICON_SVG;
        const t = window.setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = COPY_ICON_SVG;
        }, COPIED_DURATION_MS);
        (copyBtn as unknown as { _copyTimeout?: number })._copyTimeout = t;
      },
    });

    // Arrange in a 3x3 joystick-style grid via CSS grid areas.
    controls.appendChild(zoomInBtn);
    controls.appendChild(upBtn);
    controls.appendChild(leftBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(rightBtn);
    controls.appendChild(zoomOutBtn);
    controls.appendChild(downBtn);

    const parent = node.parentNode;
    if (parent) {
      parent.insertBefore(wrapper, node);
      wrapper.appendChild(controls);
      wrapper.appendChild(node);
      wrapper.appendChild(copyBtn);
    }

    // Ensure initial scale is applied.
    applyScale();
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

/**
 * Uses KaTeX's auto-render extension to parse text nodes for $, $$, \(\), and \[\]
 * and replaces them with rendered math HTML.
 */
function enhanceMathBlocks(container: HTMLDivElement) {
  if (typeof window === "undefined" || !(window as any).renderMathInElement) return;

  try {
    (window as any).renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
    });
  } catch (e) {
    console.warn("KaTeX render error:", e);
  }
}

export function MarkdownPreviewWeb({
  html,
  onToggleCheckbox,
  contentContainerStyle,
  className,
}: MarkdownPreviewWebProps) {
  const { colors, isDark } = useThemeColors() as { colors: any; isDark: boolean };
  const theme = getMarkdownThemeFromPalette(colors, isDark);
  const css = getPreviewCss(theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const onToggleRef = useRef(onToggleCheckbox);
  onToggleRef.current = onToggleCheckbox;
  const mermaidRef = useRef<any | null>(null);

  // Initialize Mermaid lazily in the browser so bundlers / SSR never import it on the server.
  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const mod = await import("mermaid");
        const m: any = (mod as any).default ?? mod;
        if (cancelled || !m) return;
        m.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: isDark ? "dark" : "default",
        });
        mermaidRef.current = m;
      } catch {
        // If mermaid fails to load, skip diagrams but keep the rest of preview working.
      }
    })();

    // Dynamically inject KaTeX
    (async () => {
      try {
        if (!document.getElementById("katex-css")) {
          const link = document.createElement("link");
          link.id = "katex-css";
          link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css";
          link.crossOrigin = "anonymous";
          document.head.appendChild(link);
        }

        if (!document.getElementById("katex-js")) {
          const script = document.createElement("script");
          script.id = "katex-js";
          script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js";
          script.crossOrigin = "anonymous";
          script.onload = () => {
            if (!document.getElementById("katex-auto-render-js")) {
              const script2 = document.createElement("script");
              script2.id = "katex-auto-render-js";
              script2.src = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js";
              script2.crossOrigin = "anonymous";
              script2.onload = () => {
                // Force a re-run of DOM enhancers so math is rendered once script loads.
                if (containerRef.current) {
                  enhanceMathBlocks(containerRef.current);
                }
              };
              document.head.appendChild(script2);
            } else if (containerRef.current) {
              enhanceMathBlocks(containerRef.current);
            }
          };
          document.head.appendChild(script);
        } else if (document.getElementById("katex-auto-render-js") && containerRef.current) {
          enhanceMathBlocks(containerRef.current);
        }
      } catch {
        // Ignore failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDark]);

  // Best-effort "post-processing" for innerHTML content: we:
  // - enhance checkboxes
  // - attach copy buttons to code blocks
  // - wrap tables/images
  // and keep those enhancements in place across React re-renders by
  // observing DOM mutations and re-running idempotent helpers.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    const runEnhancers = () => {
      replaceCheckboxesWithDom(container, (taskIndex) => onToggleRef.current?.(taskIndex));
      addCodeCopyButtons(container);
      wrapWideTables(container);
      wrapImagesWithCaptions(container);
      // After structural enhancers run, render any Mermaid diagrams present.
      if (mermaidRef.current) {
        try {
          const mermaid: any = mermaidRef.current;
          const mermaidNodes = container.querySelectorAll<HTMLElement>(".mermaid");
          if (mermaidNodes.length > 0) {
            // Mermaid v10+ exposes run; fall back to init if needed.
            if (typeof mermaid.run === "function") {
              mermaid.run({ nodes: mermaidNodes });
            } else if (typeof mermaid.init === "function") {
              mermaid.init(undefined, mermaidNodes);
            }
          }
        } catch {
          // Ignore mermaid failures so preview never breaks other content.
        }
      }
      // After diagrams are rendered into SVG, wrap them in a block with controls.
      enhanceMermaidBlocks(container);

      // Render Math
      enhanceMathBlocks(container);
    };

    runEnhancers();

    const observer = new MutationObserver(() => {
      // Batch multiple mutations; helpers are idempotent and cheap for
      // typical note sizes, so we can safely re-run.
      runEnhancers();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
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
