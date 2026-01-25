export type MarkdownEditorSyntaxToken =
  | "text"
  | "punctuation"
  | "heading.marker"
  | "heading.text"
  | "blockquote.marker"
  | "list.marker"
  | "hr"
  | "emphasis.marker"
  | "emphasis.text"
  | "link.brackets"
  | "link.text"
  | "link.url"
  | "image.brackets"
  | "image.alt"
  | "image.url"
  | "inlineCode.marker"
  | "inlineCode.text"
  | "inlineCode.bg"
  | "fence.marker"
  | "fence.language"
  | "code.text"
  | "code.comment"
  | "code.string"
  | "code.number"
  | "code.keyword"
  | "code.builtin"
  | "code.type"
  | "code.function"
  | "code.operator";

export type MarkdownEditorSyntaxPalette = Record<MarkdownEditorSyntaxToken, string>;

/**
 * Markdown editor syntax palette.
 *
 * These are intentionally “vivid but readable” colors so that in *editing mode*
 * the raw markdown stops looking monochrome.
 */
export const MARKDOWN_EDITOR_SYNTAX_COLORS: Record<"light" | "dark", MarkdownEditorSyntaxPalette> = {
  dark: {
    text: "#E5E7EB",
    punctuation: "#94A3B8",
    "heading.marker": "#A78BFA",
    "heading.text": "#E879F9",
    "blockquote.marker": "#22C55E",
    "list.marker": "#F59E0B",
    hr: "#64748B",
    "emphasis.marker": "#60A5FA",
    "emphasis.text": "#E5E7EB",
    "link.brackets": "#94A3B8",
    "link.text": "#38BDF8",
    "link.url": "#CBD5E1",
    "image.brackets": "#94A3B8",
    "image.alt": "#FCA5A5",
    "image.url": "#CBD5E1",
    "inlineCode.marker": "#F472B6",
    "inlineCode.text": "#F472B6",
    "inlineCode.bg": "rgba(244, 114, 182, 0.12)",
    "fence.marker": "#FB923C",
    "fence.language": "#FB7185",
    "code.text": "#E2E8F0",
    "code.comment": "#64748B",
    "code.string": "#86EFAC",
    "code.number": "#FDBA74",
    "code.keyword": "#A78BFA",
    "code.builtin": "#2DD4BF",
    "code.type": "#2DD4BF",
    "code.function": "#60A5FA",
    "code.operator": "#E5E7EB",
  },
  light: {
    text: "#111827",
    punctuation: "#6B7280",
    "heading.marker": "#7C3AED",
    "heading.text": "#1D4ED8",
    "blockquote.marker": "#16A34A",
    "list.marker": "#B45309",
    hr: "#6B7280",
    "emphasis.marker": "#2563EB",
    "emphasis.text": "#111827",
    "link.brackets": "#6B7280",
    "link.text": "#0EA5E9",
    "link.url": "#374151",
    "image.brackets": "#6B7280",
    "image.alt": "#DC2626",
    "image.url": "#374151",
    "inlineCode.marker": "#BE185D",
    "inlineCode.text": "#BE185D",
    "inlineCode.bg": "rgba(190, 24, 93, 0.08)",
    "fence.marker": "#C2410C",
    "fence.language": "#DB2777",
    "code.text": "#0F172A",
    "code.comment": "#64748B",
    "code.string": "#15803D",
    "code.number": "#C2410C",
    "code.keyword": "#7C3AED",
    "code.builtin": "#0F766E",
    "code.type": "#0F766E",
    "code.function": "#2563EB",
    "code.operator": "#111827",
  },
};

