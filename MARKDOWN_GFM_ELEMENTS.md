# GitHub-style Markdown (GFM) support

This project’s editors (web + native WebView) use **CodeMirror 6** with the **GFM-flavored** markdown parser from `@codemirror/lang-markdown` (`markdownLanguage`).

## What “supported” means

- **Parse + highlight**: the editor understands the syntax and can highlight it.
- **Editor styling**: extra CSS classes are added for consistent styling (blockquote/code/table/etc).
- **Inline preview**: some markup is hidden on non-active lines (Joplin-style “rich markdown”).
- **Interactive**: the editor provides UI behavior (e.g. clicking task checkboxes toggles `[ ]` / `[x]`).

## CommonMark elements (baseline)

- **Paragraphs**
- **Hard line breaks**: end a line with two spaces
- **Headings**
  - `# H1` … `###### H6`
  - Setext: `H1\n===` / `H2\n---`
- **Emphasis**
  - Italic: `*text*` / `_text_`
  - Bold: `**text**` / `__text__`
- **Blockquotes**: `> quote`
- **Lists**
  - Unordered: `- item` / `* item` / `+ item`
  - Ordered: `1. item`
  - Nested lists (indent)
- **Links**
  - Inline: `[text](https://example.com)`
  - Reference-style: `[text][id]` + `[id]: https://example.com`
- **Images**
  - Inline: `![alt](path-or-url)`
  - Reference-style: `![alt][id]`
- **Inline code**: `` `code` ``
- **Code blocks**
  - Fenced: <code>```js\n...\n```</code>
  - Indented: 4 spaces
- **Horizontal rules**: `---` / `***` / `___`
- **Escapes**: `\*literal asterisk\*`
- **Inline/Block HTML** (parsed as markdown allows)

## GitHub Flavored Markdown (GFM) additions (enabled)

- **Strikethrough**: `~~deleted~~`
- **Task lists**:
  - `- [ ] todo`
  - `- [x] done`
  - **Interactive**: checkbox UI toggles the marker.
- **Tables**:
  - `| a | b |`
  - `|---|---|`
  - `| 1 | 2 |`
- **Autolinks**:
  - `<https://example.com>`
  - `<user@example.com>`

## GitHub-adjacent extras included by the parser

These are included by `@codemirror/lang-markdown`’s `markdownLanguage`:

- **Emoji syntax** (shortcodes like `:smile:`)
- **Subscript / superscript** (syntax depends on parser rules)

## Editor-specific styling & behavior parity (web + native)

The following are applied consistently on both editors:

- **Block styling** via `webviewBundles/markdownEditorBundle/markdownDecorations.ts`
  - Blockquotes, code blocks, headings, tables
  - Inline marks: inline code, URLs, strikethrough, task markers, horizontal rules
- **Joplin-style inline preview**
  - Hides non-active-line markup characters
  - Replaces task markers with a checkbox UI

## Known gaps (not implemented yet)

These are **not** currently engineered as first-class syntax/features in the editors:

- **Footnotes** (GitHub supports these in some contexts)
- **Math blocks / inline math**
- **GitHub “alerts/callouts”** (e.g. `> [!NOTE]`)
- **Mention/issue/PR autolinking** (e.g. `@user`, `#123`)

If you want, I can implement these as additional markdown parser extensions + decorations (kept identical between web and native).

