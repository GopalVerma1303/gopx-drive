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
    // heading text uses the same color as its '#'
    "heading.text": "#A78BFA",
    "blockquote.marker": "#22C55E",
    "list.marker": "#F59E0B",
    hr: "#64748B",
    "emphasis.marker": "#60A5FA",
    // emphasis text uses the same color as its markers
    "emphasis.text": "#60A5FA",
    // link element uses a single color across its parts
    "link.text": "#38BDF8",
    "link.brackets": "#38BDF8",
    "link.url": "#38BDF8",
    // image element uses a single color across its parts
    "image.alt": "#FCA5A5",
    "image.brackets": "#FCA5A5",
    "image.url": "#FCA5A5",
    "inlineCode.marker": "#F472B6",
    "inlineCode.text": "#F472B6",
    "inlineCode.bg": "rgba(244, 114, 182, 0.12)",
    "fence.marker": "#FB923C",
    // fence language uses the same color as the fence marker
    "fence.language": "#FB923C",
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
    // heading text uses the same color as its '#'
    "heading.text": "#7C3AED",
    "blockquote.marker": "#16A34A",
    "list.marker": "#B45309",
    hr: "#6B7280",
    "emphasis.marker": "#2563EB",
    // emphasis text uses the same color as its markers
    "emphasis.text": "#2563EB",
    // link element uses a single color across its parts
    "link.text": "#0EA5E9",
    "link.brackets": "#0EA5E9",
    "link.url": "#0EA5E9",
    // image element uses a single color across its parts
    "image.alt": "#DC2626",
    "image.brackets": "#DC2626",
    "image.url": "#DC2626",
    "inlineCode.marker": "#BE185D",
    "inlineCode.text": "#BE185D",
    "inlineCode.bg": "rgba(190, 24, 93, 0.08)",
    "fence.marker": "#C2410C",
    // fence language uses the same color as the fence marker
    "fence.language": "#C2410C",
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

