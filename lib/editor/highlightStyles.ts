import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Syntax highlighting tuned for dark backgrounds (markdown editor in dark theme). */
export const darkMarkdownHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, color: "#9ca3af" },
  { tag: tags.link, color: "#93c5fd", textDecoration: "underline" },
  { tag: tags.heading, color: "#f3f4f6", fontWeight: "bold", textDecoration: "underline" },
  { tag: tags.emphasis, color: "#e5e7eb", fontStyle: "italic" },
  { tag: tags.strong, color: "#f9fafb", fontWeight: "bold" },
  { tag: tags.strikethrough, color: "#d1d5db", textDecoration: "line-through" },
  { tag: tags.keyword, color: "#c4b5fd" },
  { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName], color: "#93c5fd" },
  { tag: [tags.literal, tags.inserted], color: "#86efac" },
  { tag: [tags.string, tags.deleted], color: "#fca5a5" },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: "#fcd34d" },
  { tag: tags.definition(tags.variableName), color: "#93c5fd" },
  { tag: tags.local(tags.variableName), color: "#67e8f9" },
  { tag: [tags.typeName, tags.namespace], color: "#a5b4fc" },
  { tag: tags.className, color: "#fde047" },
  { tag: [tags.special(tags.variableName), tags.macroName], color: "#c4b5fd" },
  { tag: tags.definition(tags.propertyName), color: "#93c5fd" },
  { tag: tags.comment, color: "#6b7280" },
  { tag: tags.invalid, color: "#f87171" },
]);
