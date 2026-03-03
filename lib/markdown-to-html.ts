/**
 * Converts markdown to sanitized HTML using unified/remark/rehype.
 * Used by MarkdownPreview for both web (dangerouslySetInnerHTML) and native (WebView).
 * Code blocks get syntax highlighting via rehype-highlight (highlight.js).
 * Caller should apply linkify to the markdown before passing if desired.
 */

import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/** Sanitize schema that allows highlight.js classes on code and span for syntax highlighting. */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", "hljs", /^language-/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^hljs-/],
    ],
  },
};

let processor: ReturnType<typeof createProcessor> | null = null;

function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHighlight, { subset: false })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
}

function getProcessor() {
  if (!processor) processor = createProcessor();
  return processor;
}

/**
 * Convert markdown string to sanitized HTML.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown || !markdown.trim()) return "";
  const proc = getProcessor();
  const file = await proc.process(markdown);
  return String(file);
}
